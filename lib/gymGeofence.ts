import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

export const GYM_TASK = 'pumped-gym-proximity';

const KEY_GYM_LAT = 'pumped_gym_lat';
const KEY_GYM_LNG = 'pumped_gym_lng';
const KEY_GYM_LAST_NOTIFIED = 'pumped_gym_last_notified';

// Haversine distance in metres
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Define the background task — must be called at module level before app renders
TaskManager.defineTask(GYM_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
  if (error) return;
  const locations = data?.locations;
  if (!locations?.length) return;
  const { latitude, longitude } = locations[locations.length - 1].coords;

  try {
    const latStr = await SecureStore.getItemAsync(KEY_GYM_LAT);
    const lngStr = await SecureStore.getItemAsync(KEY_GYM_LNG);
    if (!latStr || !lngStr) return;
    const gymLat = parseFloat(latStr);
    const gymLng = parseFloat(lngStr);
    if (isNaN(gymLat) || isNaN(gymLng)) return;

    const dist = haversineM(latitude, longitude, gymLat, gymLng);
    if (dist > 500) return;

    const today = new Date().toISOString().split('T')[0];
    const lastNotified = await SecureStore.getItemAsync(KEY_GYM_LAST_NOTIFIED);
    if (lastNotified === today) return;

    await SecureStore.setItemAsync(KEY_GYM_LAST_NOTIFIED, today);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "You're at the gym!",
        body: "Time to log your workout. Let's get it. 💪",
      },
      trigger: null,
    });
  } catch {}
});

export async function startGymProximityTask(): Promise<void> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return;
  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== 'granted') return;

  const isRunning = await Location.hasStartedLocationUpdatesAsync(GYM_TASK);
  if (isRunning) return;

  await Location.startLocationUpdatesAsync(GYM_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 100,
    timeInterval: 5 * 60 * 1000,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'Forge',
      notificationBody: 'Monitoring gym proximity',
      notificationColor: '#111111',
    },
  });
}

export async function stopGymProximityTask(): Promise<void> {
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(GYM_TASK);
    if (isRunning) await Location.stopLocationUpdatesAsync(GYM_TASK);
  } catch {}
}

export async function saveGymLocation(lat: number, lng: number): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY_GYM_LAT, String(lat)),
    SecureStore.setItemAsync(KEY_GYM_LNG, String(lng)),
  ]);
}

export async function clearGymLocation(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_GYM_LAT),
    SecureStore.deleteItemAsync(KEY_GYM_LNG),
  ]);
}

export async function loadGymLocation(): Promise<{ lat: number; lng: number } | null> {
  const [latStr, lngStr] = await Promise.all([
    SecureStore.getItemAsync(KEY_GYM_LAT),
    SecureStore.getItemAsync(KEY_GYM_LNG),
  ]);
  if (!latStr || !lngStr) return null;
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
}
