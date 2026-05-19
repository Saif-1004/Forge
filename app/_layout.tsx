import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';
import { useSettingsStore } from '@/store/settingsStore';
import { database } from '@/lib/watermelon/database';
import { seedExercisesIfNeeded } from '@/lib/watermelon/seed';
import { scheduleWorkoutReminder } from '@/lib/notifications';
import { configureRevenueCat, signOutRevenueCat } from '@/lib/revenuecat';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://647d2b08ea2f4eb593015a4a6afeb237@o4511411565101056.ingest.de.sentry.io/4511411574603856',
  enabled: !__DEV__,
  sendDefaultPii: false,
  enableLogs: true,
  enableNativeCrashHandling: true,
  enableAutoSessionTracking: true,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],
  beforeSend(event) {
    // Stale refresh tokens are expected — Supabase handles them by signing out.
    const msg = event.exception?.values?.[0]?.value ?? '';
    if (msg.includes('Refresh Token Not Found') || msg.includes('refresh_token_not_found')) {
      return null;
    }
    return event;
  },
});


const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 2 },
  },
});

export default Sentry.wrap(function RootLayout() {
  const { setSession } = useAuthStore();
  const { load: loadSettings } = useSettingsStore();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    seedExercisesIfNeeded().catch(() => {});
    loadSettings().then(() => {
      const { notificationsEnabled, notificationHour, notificationMinute } = useSettingsStore.getState();
      if (notificationsEnabled) {
        scheduleWorkoutReminder(notificationHour, notificationMinute).catch(() => {});
      }
    }).catch(() => {});

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Must NOT be async — Supabase awaits async callbacks while holding its
        // internal lock, causing a deadlock when setSession calls supabase.from().
        // Fire setSession without await so the lock releases immediately.
        setSession(session).then(() => {
          if (event === 'SIGNED_IN') {
            const { onboardingCompleted, user } = useAuthStore.getState();
            if (user) configureRevenueCat(user.id).catch(() => {});
            router.replace(onboardingCompleted ? '/(tabs)' : '/onboarding/name');
          } else if (event === 'SIGNED_OUT') {
            signOutRevenueCat().catch(() => {});
            router.replace('/(auth)');
          }
        }).catch(() => {});
      },
    );

    // Trigger sync when app returns to foreground
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        const { user } = useAuthStore.getState();
        if (user) {
          useSyncStore.getState().sync(user.id).catch(() => {});
        }
      }
      appState.current = nextState;
    });

    // Navigate to workout tab on notification tap
    const notifSub = Notifications.addNotificationResponseReceivedListener(() => {
      router.navigate('/(tabs)/workout');
    });

    return () => {
      subscription.unsubscribe();
      appStateSub.remove();
      notifSub.remove();
    };
  }, [setSession, loadSettings]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DatabaseProvider database={database}>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
          </QueryClientProvider>
        </DatabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});
