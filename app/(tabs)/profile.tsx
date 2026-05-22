import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Switch,
  Platform,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { scheduleWorkoutReminder, cancelWorkoutReminder, requestNotificationPermissions } from '@/lib/notifications';
import { supabase } from '@/lib/supabase/client';
import { saveGymLocation, clearGymLocation, loadGymLocation, startGymProximityTask, stopGymProximityTask } from '@/lib/gymGeofence';
import { database } from '@/lib/watermelon/database';
import type { BodyWeightLog } from '@/lib/watermelon/models';

const REST_PRESETS = [
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '90s', seconds: 90 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
];

const GOAL_LABELS: Record<string, string> = {
  muscle: 'Build muscle',
  fat_loss: 'Lose fat',
  endurance: 'Endurance',
  athletic: 'Athletic',
  consistency: 'Consistency',
};

function kgToDisplay(kg: number, isImperial: boolean): string {
  return isImperial ? String(Math.round((kg / 0.453592) * 10) / 10) : String(kg);
}

function displayToKg(val: string, isImperial: boolean): number {
  const n = parseFloat(val);
  return isImperial ? Math.round(n * 0.453592 * 10) / 10 : n;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function ProfileTab() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    user, displayName, photoUrl, unitPreference,
    primaryGoal, trainingDaysPerWeek, bodyWeightKg,
    updateDisplayName, updateUnitPreference, updateGoals, updatePhotoUrl, signOut,
  } = useAuthStore();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const {
    defaultRestSeconds, setRestSeconds,
    calorieGoal, proteinGoal, carbsGoal, fatGoal, waterGoalMl, setGoals,
    notificationsEnabled, notificationHour, notificationMinute, setNotificationTime,
    themeMode, setThemeMode,
    hideDurationClock, setHideDurationClock,
    gymProximityEnabled, setGymProximityEnabled,
  } = useSettingsStore();
  const [gymLocation, setGymLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [settingGym, setSettingGym] = useState(false);

  const isImperial = unitPreference === 'lbs';
  const weightUnit = isImperial ? 'lbs' : 'kg';

  const [nameInput, setNameInput] = useState(displayName ?? '');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [togglingUnit, setTogglingUnit] = useState(false);

  const [editingGoals, setEditingGoals] = useState(false);
  const [calInput, setCalInput] = useState(String(calorieGoal));
  const [proteinInput, setProteinInput] = useState(String(proteinGoal));
  const [carbsInput, setCarbsInput] = useState(String(carbsGoal));
  const [fatInput, setFatInput] = useState(String(fatGoal));
  const [waterInput, setWaterInput] = useState(String(waterGoalMl));

  const [editingBodyWeight, setEditingBodyWeight] = useState(false);
  const [bodyWeightInput, setBodyWeightInput] = useState(
    bodyWeightKg != null ? kgToDisplay(bodyWeightKg, isImperial) : '',
  );
  const [savingBodyWeight, setSavingBodyWeight] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleSaveName = async () => {
    setSavingName(true);
    try { await updateDisplayName(nameInput); } finally {
      setSavingName(false);
      setEditingName(false);
    }
  };

  const handleUnitToggle = async (pref: 'kg' | 'lbs') => {
    if (pref === unitPreference || togglingUnit) return;
    setTogglingUnit(true);
    try { await updateUnitPreference(pref); } finally { setTogglingUnit(false); }
  };

  const handleOpenNutrition = () => {
    setCalInput(String(calorieGoal));
    setProteinInput(String(proteinGoal));
    setCarbsInput(String(carbsGoal));
    setFatInput(String(fatGoal));
    setWaterInput(String(waterGoalMl));
    setEditingGoals(true);
  };

  const handleSaveNutrition = async () => {
    await setGoals({
      calorieGoal: parseInt(calInput, 10) || calorieGoal,
      proteinGoal: parseInt(proteinInput, 10) || proteinGoal,
      carbsGoal: parseInt(carbsInput, 10) || carbsGoal,
      fatGoal: parseInt(fatInput, 10) || fatGoal,
      waterGoalMl: parseInt(waterInput, 10) || waterGoalMl,
    });
    setEditingGoals(false);
  };

  const handleToggleNotifications = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permission needed', 'Enable notifications in Settings to use workout reminders.');
        return;
      }
      await setNotificationTime(true, notificationHour, notificationMinute);
      await scheduleWorkoutReminder(notificationHour, notificationMinute);
    } else {
      await setNotificationTime(false, notificationHour, notificationMinute);
      await cancelWorkoutReminder();
    }
  };

  const handleSaveBodyWeight = async () => {
    if (!user) return;
    const n = parseFloat(bodyWeightInput);
    if (isNaN(n) || n < 20 || n > (isImperial ? 660 : 300)) {
      Alert.alert('Invalid weight', `Enter a weight between ${isImperial ? '44–660 lbs' : '20–300 kg'}`);
      return;
    }
    setSavingBodyWeight(true);
    try {
      const kg = displayToKg(bodyWeightInput, isImperial);
      const col = database.collections.get<BodyWeightLog>('body_weight_logs');
      await database.write(async () => {
        await col.create(r => {
          r.userId = user.id;
          r.weight = n;
          r.unit = weightUnit;
          r.loggedAt = Date.now();
          r.date = toISODate(new Date());
          r.isDeleted = false;
          r.remoteId = null;
          r.syncedAt = null;
        });
      });
      await updateGoals({ bodyWeightKg: kg });
    } finally {
      setSavingBodyWeight(false);
      setEditingBodyWeight(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete account', 'This will permanently delete your account and all data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!user) return;
          try { await supabase.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', user.id); } catch {}
          signOut();
        },
      },
    ]);
  };

  const handlePickPhoto = async () => {
    if (!user) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: asset.mimeType ?? 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await updatePhotoUrl(publicUrl);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Load gym location on mount
  useState(() => { loadGymLocation().then(setGymLocation).catch(() => {}); });

  const handleToggleGymProximity = async (val: boolean) => {
    if (val) {
      const { status: fg } = await Location.requestForegroundPermissionsAsync();
      if (fg !== 'granted') {
        Alert.alert('Permission needed', 'Allow location access in Settings to use gym proximity alerts.');
        return;
      }
      await setGymProximityEnabled(true);
      startGymProximityTask().catch(() => {});
    } else {
      await setGymProximityEnabled(false);
      stopGymProximityTask().catch(() => {});
    }
  };

  const handleSetGymLocation = async () => {
    setSettingGym(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location access to set your gym location.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      await saveGymLocation(latitude, longitude);
      setGymLocation({ lat: latitude, lng: longitude });
      Alert.alert('Gym location saved', `Set to ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not get location');
    } finally {
      setSettingGym(false);
    }
  };

  const handleClearGymLocation = async () => {
    await clearGymLocation();
    setGymLocation(null);
    await setGymProximityEnabled(false);
    stopGymProximityTask().catch(() => {});
  };

  const goalSummary = [
    primaryGoal ? GOAL_LABELS[primaryGoal] : null,
    trainingDaysPerWeek ? `${trainingDaysPerWeek}d/wk` : null,
  ].filter(Boolean).join(' · ') || 'Not set';

  const s = spacing;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + s[5], paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, paddingHorizontal: s[5], marginBottom: s[6] }}>
        Profile
      </Text>

      {/* ── Avatar ── */}
      <View style={{ alignItems: 'center', marginBottom: s[6] }}>
        <Pressable onPress={handlePickPhoto} disabled={uploadingPhoto} style={{ position: 'relative' }}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface }}
            />
          ) : (
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: fontWeight.semibold }}>
                {(displayName ?? user?.email ?? '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' }}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={{ color: colors.background, fontSize: 13 }}>✎</Text>
            )}
          </View>
        </Pressable>
        {displayName && (
          <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold, marginTop: s[3] }}>
            {displayName}
          </Text>
        )}
      </View>

      {/* ── Account ── */}
      <SectionHeader label="ACCOUNT" colors={colors} fontSize={fontSize} spacing={s} />
      <Card colors={colors} radius={radius} spacing={s}>
        {editingName ? (
          <Row>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              style={{ color: colors.text, fontSize: fontSize.base, flex: 1, padding: 0 }}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            {savingName ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <View style={styles.row}>
                <Pressable onPress={() => { setNameInput(displayName ?? ''); setEditingName(false); }} hitSlop={8}>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSaveName} hitSlop={8} style={{ marginLeft: s[4] }}>
                  <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Save</Text>
                </Pressable>
              </View>
            )}
          </Row>
        ) : (
          <Pressable onPress={() => { setNameInput(displayName ?? ''); setEditingName(true); }} style={styles.pressableRow}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, width: 60 }}>Name</Text>
            <Text style={{ color: displayName ? colors.text : colors.textMuted, fontSize: fontSize.base, flex: 1 }}>
              {displayName ?? 'Add name'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Edit</Text>
          </Pressable>
        )}
        <Divider colors={colors} spacing={s} />
        <View style={styles.pressableRow}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, width: 60 }}>Email</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base, flex: 1 }} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
      </Card>

      {/* ── Fitness ── */}
      <SectionHeader label="FITNESS" colors={colors} fontSize={fontSize} spacing={s} />
      <Card colors={colors} radius={radius} spacing={s}>
        <Pressable onPress={() => router.push('/goals')} style={styles.pressableRow}>
          <Text style={{ color: colors.text, fontSize: fontSize.base, flex: 1 }}>My Goals</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginRight: s[2] }} numberOfLines={1}>
            {goalSummary}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>›</Text>
        </Pressable>
        <Divider colors={colors} spacing={s} />
        {editingBodyWeight ? (
          <Row>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, width: 60 }}>Weight</Text>
            <TextInput
              value={bodyWeightInput}
              onChangeText={setBodyWeightInput}
              keyboardType="decimal-pad"
              autoFocus
              style={{ color: colors.text, fontSize: fontSize.base, flex: 1, padding: 0 }}
              placeholder={`e.g. 75 ${weightUnit}`}
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleSaveBodyWeight}
            />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginRight: s[3] }}>{weightUnit}</Text>
            {savingBodyWeight ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <View style={styles.row}>
                <Pressable onPress={() => setEditingBodyWeight(false)} hitSlop={8}>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSaveBodyWeight} hitSlop={8} style={{ marginLeft: s[4] }}>
                  <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Log</Text>
                </Pressable>
              </View>
            )}
          </Row>
        ) : (
          <Pressable
            onPress={() => {
              setBodyWeightInput(bodyWeightKg != null ? kgToDisplay(bodyWeightKg, isImperial) : '');
              setEditingBodyWeight(true);
            }}
            style={styles.pressableRow}
          >
            <Text style={{ color: colors.text, fontSize: fontSize.base, flex: 1 }}>Body Weight</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginRight: s[2] }}>
              {bodyWeightKg != null ? `${kgToDisplay(bodyWeightKg, isImperial)} ${weightUnit}` : 'Log weight'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>›</Text>
          </Pressable>
        )}
      </Card>

      {/* ── Settings ── */}
      <SectionHeader label="SETTINGS" colors={colors} fontSize={fontSize} spacing={s} />
      <Card colors={colors} radius={radius} spacing={s}>

        {/* Weight unit */}
        <View style={[styles.pressableRow, { paddingVertical: s[3] }]}>
          <Text style={{ color: colors.text, fontSize: fontSize.base, flex: 1 }}>Weight Unit</Text>
          <View style={[styles.row, { backgroundColor: colors.background, borderRadius: radius.md, padding: 3, gap: 3 }]}>
            {(['kg', 'lbs'] as const).map((opt) => {
              const active = unitPreference === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => handleUnitToggle(opt)}
                  disabled={togglingUnit}
                  style={{ backgroundColor: active ? colors.text : 'transparent', borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: 10 }}
                >
                  <Text style={{ color: active ? colors.background : colors.textMuted, fontSize: fontSize.sm, fontWeight: active ? fontWeight.semibold : fontWeight.normal }}>
                    {opt.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {togglingUnit && <ActivityIndicator size="small" color={colors.textMuted} style={{ marginLeft: s[2] }} />}
        </View>
        <Divider colors={colors} spacing={s} />

        {/* Rest timer */}
        <View style={{ paddingHorizontal: s[4], paddingVertical: s[3] }}>
          <Text style={{ color: colors.text, fontSize: fontSize.base, marginBottom: s[2] }}>Default Rest Timer</Text>
          <View style={[styles.row, { flexWrap: 'wrap', gap: s[2] }]}>
            {REST_PRESETS.map((p) => {
              const active = defaultRestSeconds === p.seconds;
              return (
                <Pressable
                  key={p.seconds}
                  onPress={() => setRestSeconds(p.seconds)}
                  style={{ backgroundColor: active ? colors.text : colors.background, borderRadius: radius.md, paddingVertical: s[2], paddingHorizontal: s[3] }}
                >
                  <Text style={{ color: active ? colors.background : colors.textMuted, fontSize: fontSize.sm, fontWeight: active ? fontWeight.semibold : fontWeight.normal }}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Divider colors={colors} spacing={s} />

        {/* Reminders */}
        <View style={[styles.pressableRow, { paddingVertical: s[3] }]}>
          <Text style={{ color: colors.text, fontSize: fontSize.base, flex: 1 }}>Workout Reminders</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: colors.border, true: colors.text }}
            thumbColor={colors.background}
          />
        </View>
        {notificationsEnabled && (
          <>
            <Divider colors={colors} spacing={s} />
            <Pressable onPress={() => setShowTimePicker(true)} style={styles.pressableRow}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, flex: 1 }}>Reminder time</Text>
              <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
                {String(notificationHour).padStart(2, '0')}:{String(notificationMinute).padStart(2, '0')}
              </Text>
            </Pressable>
          </>
        )}
        {showTimePicker && (
          <DateTimePicker
            value={new Date(2000, 0, 1, notificationHour, notificationMinute)}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={async (_, d) => {
              setShowTimePicker(false);
              if (!d) return;
              const h = d.getHours();
              const m = d.getMinutes();
              await setNotificationTime(true, h, m);
              await scheduleWorkoutReminder(h, m);
            }}
          />
        )}
        <Divider colors={colors} spacing={s} />

        {/* Nutrition goals */}
        {editingGoals ? (
          <View style={{ paddingHorizontal: s[4], paddingVertical: s[3] }}>
            <Text style={{ color: colors.text, fontSize: fontSize.base, marginBottom: s[3] }}>Nutrition Goals</Text>
            <View style={{ marginBottom: s[3] }}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: s[1] }}>Calories (kcal)</Text>
              <TextInput
                value={calInput}
                onChangeText={setCalInput}
                keyboardType="number-pad"
                style={{ color: colors.text, fontSize: fontSize.base, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: s[3], paddingVertical: s[2] }}
              />
            </View>
            <View style={[styles.row, { gap: s[3], marginBottom: s[3] }]}>
              {[
                { label: 'Protein (g)', value: proteinInput, set: setProteinInput },
                { label: 'Carbs (g)', value: carbsInput, set: setCarbsInput },
                { label: 'Fat (g)', value: fatInput, set: setFatInput },
              ].map(({ label, value, set }) => (
                <View key={label} style={{ flex: 1 }}>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: s[1] }}>{label}</Text>
                  <TextInput
                    value={value}
                    onChangeText={set}
                    keyboardType="number-pad"
                    style={{ color: colors.text, fontSize: fontSize.base, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: s[3], paddingVertical: s[2] }}
                  />
                </View>
              ))}
            </View>
            <View style={{ marginBottom: s[3] }}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: s[1] }}>Daily water goal (ml)</Text>
              <TextInput
                value={waterInput}
                onChangeText={setWaterInput}
                keyboardType="number-pad"
                style={{ color: colors.text, fontSize: fontSize.base, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: s[3], paddingVertical: s[2] }}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: s[4] }}>
              <Pressable onPress={() => setEditingGoals(false)} hitSlop={8}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSaveNutrition} hitSlop={8}>
                <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Save</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={handleOpenNutrition} style={styles.pressableRow}>
            <Text style={{ color: colors.text, fontSize: fontSize.base, flex: 1 }}>Nutrition Goals</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginRight: s[2] }}>{calorieGoal} kcal</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>›</Text>
          </Pressable>
        )}
        <Divider colors={colors} spacing={s} />

        {/* Appearance */}
        <View style={[styles.pressableRow, { paddingVertical: s[3] }]}>
          <Text style={{ color: colors.text, fontSize: fontSize.base, flex: 1 }}>Appearance</Text>
          <View style={[styles.row, { backgroundColor: colors.background, borderRadius: radius.md, padding: 3, gap: 3 }]}>
            {(['system', 'light', 'dark'] as const).map((mode) => {
              const active = themeMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setThemeMode(mode)}
                  style={{ backgroundColor: active ? colors.text : 'transparent', borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: 8 }}
                >
                  <Text style={{ color: active ? colors.background : colors.textMuted, fontSize: fontSize.sm, fontWeight: active ? fontWeight.semibold : fontWeight.normal }}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Divider colors={colors} spacing={s} />

        {/* Hide workout duration clock */}
        <View style={[styles.pressableRow, { paddingVertical: s[3] }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: fontSize.base }}>Hide workout clock</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>Hides the elapsed time during workouts</Text>
          </View>
          <Switch
            value={hideDurationClock}
            onValueChange={setHideDurationClock}
            trackColor={{ false: colors.border, true: colors.text }}
            thumbColor={colors.background}
          />
        </View>
        <Divider colors={colors} spacing={s} />

        {/* Gym proximity alerts */}
        <View style={[styles.pressableRow, { paddingVertical: s[3] }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: fontSize.base }}>Gym Proximity Alerts</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>Notify when you arrive at the gym</Text>
          </View>
          <Switch
            value={gymProximityEnabled}
            onValueChange={handleToggleGymProximity}
            trackColor={{ false: colors.border, true: colors.text }}
            thumbColor={colors.background}
          />
        </View>
        {gymProximityEnabled && (
          <>
            <Divider colors={colors} spacing={s} />
            <View style={{ paddingHorizontal: s[4], paddingVertical: s[3] }}>
              {gymLocation ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Gym location</Text>
                    <Text style={{ color: colors.text, fontSize: fontSize.sm, marginTop: 2 }}>
                      {gymLocation.lat.toFixed(4)}, {gymLocation.lng.toFixed(4)}
                    </Text>
                  </View>
                  <Pressable onPress={handleSetGymLocation} disabled={settingGym} hitSlop={8} style={{ marginRight: s[3] }}>
                    {settingGym ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={{ color: colors.text, fontSize: fontSize.sm }}>Update</Text>}
                  </Pressable>
                  <Pressable onPress={handleClearGymLocation} hitSlop={8}>
                    <Text style={{ color: colors.error, fontSize: fontSize.sm }}>Remove</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={handleSetGymLocation} disabled={settingGym} style={{ flexDirection: 'row', alignItems: 'center', gap: s[2] }}>
                  {settingGym ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <Text style={{ color: colors.text, fontSize: fontSize.sm }}>Set gym location (use current location)</Text>
                  )}
                </Pressable>
              )}
            </View>
          </>
        )}
      </Card>

      {/* ── Danger zone ── */}
      <View style={{ paddingHorizontal: s[5], marginBottom: s[3] }}>
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => ({ backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: s[4], opacity: pressed ? 0.7 : 1 })}
        >
          <Text style={{ color: colors.text, fontSize: fontSize.base, textAlign: 'center' }}>Sign out</Text>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: s[5] }}>
        <Pressable
          onPress={handleDeleteAccount}
          style={({ pressed }) => ({ backgroundColor: colors.error + '18', borderRadius: radius.lg, paddingVertical: s[4], opacity: pressed ? 0.7 : 1 })}
        >
          <Text style={{ color: colors.error, fontSize: fontSize.base, textAlign: 'center' }}>Delete account</Text>
        </Pressable>
      </View>

      {/* Credits */}
      <View style={{ paddingHorizontal: s[5], paddingTop: s[5], paddingBottom: s[3] }}>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center', lineHeight: 18 }}>
          Exercise images from{' '}
          <Text style={{ color: colors.textMuted, fontWeight: '600' }}>wger Workout Manager</Text>
          {' '}(wger.de) · CC BY SA 4.0
        </Text>
      </View>
    </ScrollView>
  );
}

function SectionHeader({ label, colors, fontSize, spacing }: { label: string; colors: any; fontSize: any; spacing: any }) {
  return (
    <Text style={{
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
      letterSpacing: 0.8,
      paddingHorizontal: spacing[5] + 4,
      marginBottom: spacing[2],
    }}>
      {label}
    </Text>
  );
}

function Card({ children, colors, radius, spacing }: { children: React.ReactNode; colors: any; radius: any; spacing: any }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, marginHorizontal: spacing[5], marginBottom: spacing[5], overflow: 'hidden' }}>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={[styles.row, { paddingHorizontal: 16, paddingVertical: 12 }]}>{children}</View>;
}

function Divider({ colors, spacing }: { colors: any; spacing: any }) {
  return <View style={{ height: 1, backgroundColor: colors.border, marginLeft: spacing[4] }} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  pressableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
});
