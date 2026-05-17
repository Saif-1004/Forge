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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { scheduleWorkoutReminder, cancelWorkoutReminder, requestNotificationPermissions } from '@/lib/notifications';
import { supabase } from '@/lib/supabase/client';
import { Eyebrow } from '@/components/ui';

const REST_PRESETS = [
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '90s', seconds: 90 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
];

export default function ProfileTab() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, displayName, unitPreference, updateDisplayName, updateUnitPreference, signOut } = useAuthStore();
  const { defaultRestSeconds, setRestSeconds, calorieGoal, proteinGoal, carbsGoal, fatGoal, setGoals, notificationsEnabled, notificationHour, notificationMinute, setNotificationTime } = useSettingsStore();

  const [nameInput, setNameInput] = useState(displayName ?? '');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [togglingUnit, setTogglingUnit] = useState(false);

  const [editingGoals, setEditingGoals] = useState(false);
  const [calInput, setCalInput] = useState(String(calorieGoal));
  const [proteinInput, setProteinInput] = useState(String(proteinGoal));
  const [carbsInput, setCarbsInput] = useState(String(carbsGoal));
  const [fatInput, setFatInput] = useState(String(fatGoal));

  const handleOpenGoals = () => {
    setCalInput(String(calorieGoal));
    setProteinInput(String(proteinGoal));
    setCarbsInput(String(carbsGoal));
    setFatInput(String(fatGoal));
    setEditingGoals(true);
  };

  const [showTimePicker, setShowTimePicker] = useState(false);

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

  const handleSaveGoals = async () => {
    await setGoals({
      calorieGoal: parseInt(calInput, 10) || calorieGoal,
      proteinGoal: parseInt(proteinInput, 10) || proteinGoal,
      carbsGoal: parseInt(carbsInput, 10) || carbsGoal,
      fatGoal: parseInt(fatInput, 10) || fatGoal,
    });
    setEditingGoals(false);
  };

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      await updateDisplayName(nameInput);
    } finally {
      setSavingName(false);
      setEditingName(false);
    }
  };

  const handleCancelName = () => {
    setNameInput(displayName ?? '');
    setEditingName(false);
  };

  const handleUnitToggle = async (pref: 'kg' | 'lbs') => {
    if (pref === unitPreference || togglingUnit) return;
    setTogglingUnit(true);
    try {
      await updateUnitPreference(pref);
    } finally {
      setTogglingUnit(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              await supabase.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', user.id);
            } catch {}
            signOut();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing[5], paddingHorizontal: spacing[5], paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginBottom: spacing[6] }}>
        Profile
      </Text>

      {/* Display name */}
      <Eyebrow>Display Name</Eyebrow>
      <View style={[styles.row, { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginBottom: spacing[4] }]}>
        {editingName ? (
          <>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              style={[styles.nameInput, { color: colors.text, fontSize: fontSize.base, flex: 1 }]}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            {savingName ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <View style={styles.nameActions}>
                <Pressable onPress={handleCancelName} hitSlop={8}>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSaveName} hitSlop={8} style={{ marginLeft: spacing[4] }}>
                  <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Save</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={{ color: displayName ? colors.text : colors.textMuted, fontSize: fontSize.base, flex: 1 }}>
              {displayName ?? 'Add your name'}
            </Text>
            <Pressable onPress={() => setEditingName(true)} hitSlop={8}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Edit</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Email */}
      <Eyebrow>Email</Eyebrow>
      <View style={[styles.row, { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginBottom: spacing[4] }]}>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>{user?.email}</Text>
      </View>

      {/* Unit preference */}
      <Eyebrow>Weight Unit</Eyebrow>
      <View style={[styles.row, { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing[2], paddingVertical: spacing[2], marginBottom: spacing[6], gap: spacing[2] }]}>
        {(['kg', 'lbs'] as const).map((opt) => {
          const active = unitPreference === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => handleUnitToggle(opt)}
              disabled={togglingUnit}
              style={[
                styles.unitBtn,
                {
                  flex: 1,
                  backgroundColor: active ? colors.text : 'transparent',
                  borderRadius: radius.md,
                  paddingVertical: spacing[2],
                },
              ]}
            >
              <Text
                style={{
                  color: active ? colors.background : colors.textMuted,
                  fontSize: fontSize.sm,
                  fontWeight: active ? fontWeight.semibold : fontWeight.normal,
                  textAlign: 'center',
                }}
              >
                {opt.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
        {togglingUnit && <ActivityIndicator size="small" color={colors.textMuted} />}
      </View>

      {/* Rest timer default */}
      <Eyebrow>Default Rest Timer</Eyebrow>
      <View style={[styles.row, { flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[6] }]}>
        {REST_PRESETS.map((p) => {
          const active = defaultRestSeconds === p.seconds;
          return (
            <Pressable
              key={p.seconds}
              onPress={() => setRestSeconds(p.seconds)}
              style={[
                styles.unitBtn,
                {
                  backgroundColor: active ? colors.text : colors.surface,
                  borderRadius: radius.md,
                  paddingVertical: spacing[2],
                  paddingHorizontal: spacing[4],
                },
              ]}
            >
              <Text style={{ color: active ? colors.background : colors.textMuted, fontSize: fontSize.sm, fontWeight: active ? fontWeight.semibold : fontWeight.normal }}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Workout reminders */}
      <Eyebrow>Workout Reminders</Eyebrow>
      <View style={[styles.row, { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginBottom: spacing[2] }]}>
        <Text style={{ color: colors.text, fontSize: fontSize.base, flex: 1 }}>Daily Reminder</Text>
        <Switch
          value={notificationsEnabled}
          onValueChange={handleToggleNotifications}
          trackColor={{ false: colors.border, true: colors.text }}
          thumbColor={colors.background}
        />
      </View>
      {notificationsEnabled && (
        <Pressable
          onPress={() => setShowTimePicker(true)}
          style={[styles.row, { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginBottom: spacing[6] }]}
        >
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, flex: 1 }}>Reminder time</Text>
          <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
            {String(notificationHour).padStart(2, '0')}:{String(notificationMinute).padStart(2, '0')}
          </Text>
        </Pressable>
      )}
      {!notificationsEnabled && <View style={{ marginBottom: spacing[6] }} />}
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

      {/* Nutrition goals */}
      <Eyebrow>Nutrition Goals</Eyebrow>
      {editingGoals ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing[4], marginBottom: spacing[6] }}>
          <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing[1] }}>Calories (kcal)</Text>
              <TextInput
                value={calInput}
                onChangeText={setCalInput}
                keyboardType="number-pad"
                style={{ color: colors.text, fontSize: fontSize.base, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[4] }}>
            {[
              { label: 'Protein (g)', value: proteinInput, set: setProteinInput },
              { label: 'Carbs (g)', value: carbsInput, set: setCarbsInput },
              { label: 'Fat (g)', value: fatInput, set: setFatInput },
            ].map(({ label, value, set }) => (
              <View key={label} style={{ flex: 1 }}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing[1] }}>{label}</Text>
                <TextInput
                  value={value}
                  onChangeText={set}
                  keyboardType="number-pad"
                  style={{ color: colors.text, fontSize: fontSize.base, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}
                />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[4] }}>
            <Pressable onPress={() => setEditingGoals(false)} hitSlop={8}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSaveGoals} hitSlop={8}>
              <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.row, { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginBottom: spacing[6] }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: fontSize.base }}>{calorieGoal} kcal</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
              P {proteinGoal}g · C {carbsGoal}g · F {fatGoal}g
            </Text>
          </View>
          <Pressable onPress={handleOpenGoals} hitSlop={8}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Edit</Text>
          </Pressable>
        </View>
      )}

      {/* Danger zone */}
      <DangerButton label="Sign out" onPress={handleSignOut} colors={colors} fontSize={fontSize} fontWeight={fontWeight} spacing={spacing} radius={radius} />
      <View style={{ height: spacing[3] }} />
      <DangerButton label="Delete account" onPress={handleDeleteAccount} colors={colors} fontSize={fontSize} fontWeight={fontWeight} spacing={spacing} radius={radius} destructive />
    </ScrollView>
  );
}

function DangerButton({ label, onPress, colors, fontSize, fontWeight, spacing, radius, destructive }: {
  label: string; onPress: () => void; colors: any; fontSize: any; fontWeight: any; spacing: any; radius: any; destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.dangerBtn,
        {
          backgroundColor: destructive ? colors.error + '18' : colors.surface,
          borderRadius: radius.lg,
          paddingVertical: spacing[4],
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={{ color: destructive ? colors.error : colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  nameInput: { padding: 0 },
  nameActions: { flexDirection: 'row', alignItems: 'center' },
  unitBtn: { alignItems: 'center' },
  dangerBtn: {},
});
