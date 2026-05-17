import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const KEY_REST = 'pumped_rest_seconds';
const KEY_CAL = 'pumped_cal_goal';
const KEY_PROTEIN = 'pumped_protein_goal';
const KEY_CARBS = 'pumped_carbs_goal';
const KEY_FAT = 'pumped_fat_goal';
const KEY_NOTIF_ENABLED = 'pumped_notif_enabled';
const KEY_NOTIF_HOUR = 'pumped_notif_hour';
const KEY_NOTIF_MINUTE = 'pumped_notif_minute';

interface SettingsStore {
  defaultRestSeconds: number;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  notificationsEnabled: boolean;
  notificationHour: number;
  notificationMinute: number;
  loaded: boolean;
  load: () => Promise<void>;
  setRestSeconds: (s: number) => Promise<void>;
  setGoals: (goals: Partial<{ calorieGoal: number; proteinGoal: number; carbsGoal: number; fatGoal: number }>) => Promise<void>;
  setNotificationTime: (enabled: boolean, hour: number, minute: number) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  defaultRestSeconds: 90,
  calorieGoal: 2000,
  proteinGoal: 150,
  carbsGoal: 200,
  fatGoal: 65,
  notificationsEnabled: false,
  notificationHour: 8,
  notificationMinute: 0,
  loaded: false,

  load: async () => {
    try {
      const [rest, cal, protein, carbs, fat, notifEnabled, notifHour, notifMin] = await Promise.all([
        SecureStore.getItemAsync(KEY_REST),
        SecureStore.getItemAsync(KEY_CAL),
        SecureStore.getItemAsync(KEY_PROTEIN),
        SecureStore.getItemAsync(KEY_CARBS),
        SecureStore.getItemAsync(KEY_FAT),
        SecureStore.getItemAsync(KEY_NOTIF_ENABLED),
        SecureStore.getItemAsync(KEY_NOTIF_HOUR),
        SecureStore.getItemAsync(KEY_NOTIF_MINUTE),
      ]);
      set({
        loaded: true,
        ...(rest ? { defaultRestSeconds: parseInt(rest, 10) } : {}),
        ...(cal ? { calorieGoal: parseInt(cal, 10) } : {}),
        ...(protein ? { proteinGoal: parseInt(protein, 10) } : {}),
        ...(carbs ? { carbsGoal: parseInt(carbs, 10) } : {}),
        ...(fat ? { fatGoal: parseInt(fat, 10) } : {}),
        ...(notifEnabled !== null ? { notificationsEnabled: notifEnabled === 'true' } : {}),
        ...(notifHour ? { notificationHour: parseInt(notifHour, 10) } : {}),
        ...(notifMin ? { notificationMinute: parseInt(notifMin, 10) } : {}),
      });
    } catch {
      set({ loaded: true });
    }
  },

  setRestSeconds: async (s) => {
    try { await SecureStore.setItemAsync(KEY_REST, String(s)); } catch {}
    set({ defaultRestSeconds: s });
  },

  setNotificationTime: async (enabled, hour, minute) => {
    try {
      await Promise.all([
        SecureStore.setItemAsync(KEY_NOTIF_ENABLED, String(enabled)),
        SecureStore.setItemAsync(KEY_NOTIF_HOUR, String(hour)),
        SecureStore.setItemAsync(KEY_NOTIF_MINUTE, String(minute)),
      ]);
    } catch {}
    set({ notificationsEnabled: enabled, notificationHour: hour, notificationMinute: minute });
  },

  setGoals: async (goals) => {
    try {
      await Promise.all([
        goals.calorieGoal !== undefined ? SecureStore.setItemAsync(KEY_CAL, String(goals.calorieGoal)) : Promise.resolve(),
        goals.proteinGoal !== undefined ? SecureStore.setItemAsync(KEY_PROTEIN, String(goals.proteinGoal)) : Promise.resolve(),
        goals.carbsGoal !== undefined ? SecureStore.setItemAsync(KEY_CARBS, String(goals.carbsGoal)) : Promise.resolve(),
        goals.fatGoal !== undefined ? SecureStore.setItemAsync(KEY_FAT, String(goals.fatGoal)) : Promise.resolve(),
      ]);
    } catch {}
    set(goals as Partial<SettingsStore>);
  },
}));
