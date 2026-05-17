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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase/client';

export default function ProfileTab() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, displayName, unitPreference, updateDisplayName, updateUnitPreference, signOut } = useAuthStore();

  const [nameInput, setNameInput] = useState(displayName ?? '');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [togglingUnit, setTogglingUnit] = useState(false);

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
            await supabase.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', user.id);
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
      <SectionLabel label="DISPLAY NAME" colors={colors} fontSize={fontSize} spacing={spacing} />
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
      <SectionLabel label="EMAIL" colors={colors} fontSize={fontSize} spacing={spacing} />
      <View style={[styles.row, { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginBottom: spacing[4] }]}>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>{user?.email}</Text>
      </View>

      {/* Unit preference */}
      <SectionLabel label="WEIGHT UNIT" colors={colors} fontSize={fontSize} spacing={spacing} />
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

      {/* Danger zone */}
      <DangerButton label="Sign out" onPress={handleSignOut} colors={colors} fontSize={fontSize} fontWeight={fontWeight} spacing={spacing} radius={radius} />
      <View style={{ height: spacing[3] }} />
      <DangerButton label="Delete account" onPress={handleDeleteAccount} colors={colors} fontSize={fontSize} fontWeight={fontWeight} spacing={spacing} radius={radius} destructive />
    </ScrollView>
  );
}

function SectionLabel({ label, colors, fontSize, spacing }: { label: string; colors: any; fontSize: any; spacing: any }) {
  return (
    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 0.8, marginBottom: spacing[2] }}>
      {label}
    </Text>
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
