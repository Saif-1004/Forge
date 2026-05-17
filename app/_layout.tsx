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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 2 },
  },
});

export default function RootLayout() {
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        await setSession(session);
        if (event === 'SIGNED_IN') {
          const { onboardingCompleted, user } = useAuthStore.getState();
          if (user) configureRevenueCat(user.id).catch(() => {});
          router.replace(onboardingCompleted ? '/(tabs)' : '/onboarding/name');
        } else if (event === 'SIGNED_OUT') {
          signOutRevenueCat().catch(() => {});
          router.replace('/(auth)');
        }
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
  }, [setSession]);

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
}
