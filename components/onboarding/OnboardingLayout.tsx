import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { ProgressBar } from './ProgressBar';

interface OnboardingLayoutProps {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onSkip?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function OnboardingLayout({
  step, total, title, subtitle, onBack, onSkip, children, footer,
}: OnboardingLayoutProps) {
  const { colors, fontSize, fontWeight, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8, paddingHorizontal: spacing[4] }]}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
          </Pressable>
        ) : <View style={styles.placeholder} />}
        <ProgressBar step={step} total={total} />
        {onSkip ? (
          <Pressable onPress={onSkip} hitSlop={12}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Skip</Text>
          </Pressable>
        ) : <View style={styles.placeholder} />}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing[5] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: fontSize.base }]}>
              {subtitle}
            </Text>
          )}
        </View>
        {children}
      </ScrollView>

      {footer && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16, paddingHorizontal: spacing[5] }]}>
          {footer}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeholder: { width: 32 },
  content: { paddingTop: 32, paddingBottom: 24 },
  header: { marginBottom: 32 },
  title: { marginBottom: 8, lineHeight: 36 },
  subtitle: { lineHeight: 22, opacity: 0.8 },
  footer: { gap: 12 },
});
