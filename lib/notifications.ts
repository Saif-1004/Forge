import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_ID = 'workout-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleWorkoutReminder(hour: number, minute: number): Promise<void> {
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  await cancelWorkoutReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: "Time to train! 💪",
      body: "Your workout is waiting. Let's go!",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    } as any,
  });
}

export async function cancelWorkoutReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch {}
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}
