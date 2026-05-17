import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase/client';
import { database } from '@/lib/watermelon/database';
import type { WorkoutSession } from '@/lib/watermelon/models';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Returns ISO Mon=1 … Sun=7 for JS getDay() (0=Sun)
function isoDay(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

interface DayData {
  date: string;          // 'YYYY-MM-DD'
  sessionId: string | null;
  muscleGroups: string[];
  isRestDay: boolean;
  restDayId: string | null;
}

export default function CalendarScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const [dayMap, setDayMap] = useState<Map<string, DayData>>(new Map());
  const [loading, setLoading] = useState(true);

  const todayStr = toISODate(now);

  const loadMonth = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const monthStart = startOfMonth(year, month);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // Load sessions from WatermelonDB
    const sessionsCol = database.collections.get<WorkoutSession>('workout_sessions');
    const sessions = await sessionsCol
      .query(
        Q.where('user_id', user.id),
        Q.where('is_deleted', false),
        Q.where('ended_at', Q.notEq(null)),
        Q.where('started_at', Q.between(monthStart.getTime(), monthEnd.getTime())),
      )
      .fetch();

    // Load rest days from Supabase
    const isoStart = toISODate(monthStart);
    const isoEnd = toISODate(monthEnd);
    const { data: restDays } = await supabase
      .from('rest_days')
      .select('id, date')
      .eq('user_id', user.id)
      .gte('date', isoStart)
      .lte('date', isoEnd);

    const map = new Map<string, DayData>();

    for (const s of sessions) {
      const dateStr = toISODate(new Date(s.startedAt));
      const existing = map.get(dateStr);
      if (!existing) {
        map.set(dateStr, {
          date: dateStr,
          sessionId: s.id,
          muscleGroups: [],
          isRestDay: false,
          restDayId: null,
        });
      }
    }

    for (const rd of (restDays ?? [])) {
      const existing = map.get(rd.date);
      if (existing) {
        existing.restDayId = rd.id;
      } else {
        map.set(rd.date, {
          date: rd.date,
          sessionId: null,
          muscleGroups: [],
          isRestDay: true,
          restDayId: rd.id,
        });
      }
      if (existing) existing.isRestDay = true;
    }

    setDayMap(map);
    setLoading(false);
  }, [user, year, month]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const handleDayPress = useCallback((dateStr: string) => {
    const data = dayMap.get(dateStr);
    const isPast = dateStr < todayStr;
    const isToday = dateStr === todayStr;

    if (data?.sessionId) {
      router.push(`/workout/session/${data.sessionId}`);
      return;
    }

    if (data?.isRestDay && data.restDayId) {
      Alert.alert(
        'Rest Day',
        `${dateStr} is marked as a rest day.`,
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Remove Rest Day',
            style: 'destructive',
            onPress: async () => {
              await supabase.from('rest_days').delete().eq('id', data.restDayId!);
              loadMonth();
            },
          },
        ],
      );
      return;
    }

    if (isPast || isToday) {
      Alert.alert(
        'Mark as Rest Day?',
        `Mark ${dateStr} as an intentional rest day?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark Rest Day',
            onPress: async () => {
              if (!user) return;
              await supabase.from('rest_days').upsert(
                { user_id: user.id, date: dateStr },
                { onConflict: 'user_id,date' },
              );
              loadMonth();
            },
          },
        ],
      );
    }
  }, [dayMap, todayStr, user, loadMonth]);

  // Build calendar grid
  const firstDay = startOfMonth(year, month);
  const totalDays = daysInMonth(year, month);
  const leadingBlanks = isoDay(firstDay) - 1; // Mon=0 offset

  const monthName = firstDay.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const cellSize = Math.floor((350 - 6 * 4) / 7);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, paddingHorizontal: spacing[5], paddingBottom: spacing[3], borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginLeft: spacing[3] }}>
          Calendar
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + 32 }}>
        {/* Month navigation */}
        <View style={[styles.monthNav, { marginTop: spacing[5], marginBottom: spacing[4] }]}>
          <Pressable onPress={prevMonth} hitSlop={12} style={[styles.navBtn, { borderColor: colors.border, borderRadius: radius.md }]}>
            <Text style={{ color: colors.text, fontSize: fontSize.base }}>‹</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
            {monthName}
          </Text>
          <Pressable onPress={nextMonth} hitSlop={12} style={[styles.navBtn, { borderColor: colors.border, borderRadius: radius.md }]}>
            <Text style={{ color: colors.text, fontSize: fontSize.base }}>›</Text>
          </Pressable>
        </View>

        {/* Weekday labels */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map((d) => (
            <View key={d} style={[styles.dayCell, { width: cellSize }]}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center' }}>{d}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.text} style={{ marginTop: spacing[8] }} />
        ) : (
          rows.map((row, ri) => (
            <View key={ri} style={styles.weekRow}>
              {row.map((day, ci) => {
                if (!day) return <View key={ci} style={[styles.dayCell, { width: cellSize }]} />;

                const d = new Date(year, month, day);
                const dateStr = toISODate(d);
                const data = dayMap.get(dateStr);
                const isToday = dateStr === todayStr;
                const isFuture = dateStr > todayStr;
                const hasSession = !!data?.sessionId;
                const isRest = !!data?.isRestDay;

                return (
                  <Pressable
                    key={ci}
                    onPress={() => handleDayPress(dateStr)}
                    disabled={isFuture}
                    style={({ pressed }) => [
                      styles.dayCell,
                      {
                        width: cellSize,
                        height: cellSize,
                        borderRadius: radius.md,
                        backgroundColor: isToday
                          ? colors.text
                          : hasSession
                          ? colors.surface
                          : 'transparent',
                        opacity: isFuture ? 0.3 : pressed ? 0.7 : 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: isToday ? colors.background : colors.text,
                        fontSize: fontSize.sm,
                        fontWeight: isToday ? fontWeight.bold : fontWeight.normal,
                      }}
                    >
                      {day}
                    </Text>
                    {/* Dot indicators */}
                    {(hasSession || isRest) && (
                      <View style={styles.dotRow}>
                        {hasSession && (
                          <View style={[styles.dot, { backgroundColor: isToday ? colors.background : colors.success }]} />
                        )}
                        {isRest && !hasSession && (
                          <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
                        )}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))
        )}

        {/* Legend */}
        <View style={[styles.legend, { marginTop: spacing[5] }]}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginLeft: 6 }}>Workout</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginLeft: 6 }}>Rest day</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.todayDot, { backgroundColor: colors.text }]} />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginLeft: 6 }}>Today</Text>
          </View>
        </View>

        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing[3], textAlign: 'center' }}>
          Tap a past empty day to mark it as a rest day
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  weekRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  dayCell: { alignItems: 'center', justifyContent: 'center', aspectRatio: 1 },
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  todayDot: { width: 10, height: 10, borderRadius: 5 },
  legend: { flexDirection: 'row', gap: 20, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
});
