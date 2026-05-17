import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { supabase } from '@/lib/supabase/client';
import { database } from '@/lib/watermelon/database';
import type { PersonalRecord, Exercise, WorkoutSession, SessionExercise, Set as SetModel, FoodLog, BodyWeightLog } from '@/lib/watermelon/models';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface CoachContext {
  displayName: string | null;
  unitPreference: string;
  primaryGoal: string | null;
  experienceLevel: string | null;
  trainingDaysPerWeek: number | null;
  heightCm: number | null;
  bodyWeight: { weight: number; unit: string; date: string } | null;
  streak: number;
  sessionsThisWeek: number;
  prsByExercise: { exercise: string; muscles: string[]; records: { reps: number; weight: number; unit: string }[] }[];
  recentSessions: {
    date: string;
    durationMin: number | null;
    sets: number;
    volume: number;
    muscles: string[];
    exercises: { name: string; sets: { reps: number; weight: number; unit: string; isWarmup: boolean }[] }[];
  }[];
  nutritionToday: { calories: number; protein: number; carbs: number; fat: number };
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
}

const QUICK_PROMPTS = [
  'What should I train today?',
  'How can I break my bench press plateau?',
  'How much protein should I eat?',
  'Suggest a deload week for me',
];

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadCoachContext(
  userId: string,
  displayName: string | null,
  unitPref: string,
  goals: { calorieGoal: number; proteinGoal: number; carbsGoal: number; fatGoal: number },
): Promise<CoachContext> {
  const prCol = database.collections.get<PersonalRecord>('personal_records');
  const exCol = database.collections.get<Exercise>('exercises');
  const sessCol = database.collections.get<WorkoutSession>('workout_sessions');
  const seCol = database.collections.get<SessionExercise>('session_exercises');
  const foodCol = database.collections.get<FoodLog>('food_logs');
  const bwCol = database.collections.get<BodyWeightLog>('body_weight_logs');

  // ── User profile from Supabase ─────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('users')
    .select('primary_goal, experience_level, training_days_per_week, height_cm')
    .eq('id', userId)
    .maybeSingle();

  // ── PRs grouped by exercise (all rep ranges) ───────────────────────────────
  const allPRs = await prCol.query(Q.where('user_id', userId), Q.where('is_deleted', false)).fetch();
  const prExIds = [...new Set(allPRs.map((pr) => pr.exerciseId))];
  const prExMap = new Map<string, Exercise>();
  await Promise.all(prExIds.map(async (id) => {
    try { prExMap.set(id, await exCol.find(id)); } catch {}
  }));
  const prMap = new Map<string, CoachContext['prsByExercise'][number]>();
  for (const pr of allPRs) {
    if (!prMap.has(pr.exerciseId)) {
      const ex = prExMap.get(pr.exerciseId);
      if (!ex) continue;
      prMap.set(pr.exerciseId, { exercise: ex.name, muscles: ex.musclePrimary, records: [] });
    }
    prMap.get(pr.exerciseId)!.records.push({ reps: pr.repCount, weight: pr.weight, unit: pr.unit });
  }
  const prsByExercise = Array.from(prMap.values()).map((e) => ({
    ...e,
    records: e.records.sort((a, b) => a.reps - b.reps),
  }));

  // ── Recent sessions with full exercise detail ──────────────────────────────
  const allSessions = await sessCol
    .query(
      Q.where('user_id', userId),
      Q.where('is_deleted', false),
      Q.where('ended_at', Q.notEq(null)),
      Q.sortBy('started_at', Q.desc),
    )
    .fetch();

  // Streak + this week count
  const today = new Date();
  const todayStr = toISODate(today);
  const workoutDates = new Set(allSessions.map((s) => toISODate(new Date(s.startedAt))));
  let streak = 0;
  let checkDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!workoutDates.has(todayStr)) checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate() - 1);
  while (workoutDates.has(toISODate(checkDate))) {
    streak++;
    checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate() - 1);
  }
  const dow = today.getDay();
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (dow === 0 ? 6 : dow - 1)).getTime();
  const sessionsThisWeek = allSessions.filter((s) => s.startedAt >= weekStart).length;

  const recentSessions: CoachContext['recentSessions'] = [];
  const recent7 = allSessions.slice(0, 7);

  if (recent7.length > 0) {
    const setsCol = database.collections.get<SetModel>('sets');
    const recent7Ids = recent7.map((s) => s.id);

    const allSEs = await seCol
      .query(Q.where('session_id', Q.oneOf(recent7Ids)), Q.where('is_deleted', false), Q.sortBy('order_index', Q.asc))
      .fetch();

    const recentExIds = [...new Set(allSEs.map((se) => se.exerciseId))];
    const recentExMap = new Map<string, Exercise>();
    await Promise.all(recentExIds.map(async (id) => {
      try { recentExMap.set(id, await exCol.find(id)); } catch {}
    }));

    const seIds = allSEs.map((se) => se.id);
    const allSets = seIds.length > 0
      ? await setsCol.query(Q.where('session_exercise_id', Q.oneOf(seIds))).fetch()
      : [];

    const setsBySE = new Map<string, SetModel[]>();
    for (const set of allSets) {
      const bucket = setsBySE.get(set.sessionExerciseId) ?? [];
      bucket.push(set);
      setsBySE.set(set.sessionExerciseId, bucket);
    }
    const seBySession = new Map<string, SessionExercise[]>();
    for (const se of allSEs) {
      const bucket = seBySession.get(se.sessionId) ?? [];
      bucket.push(se);
      seBySession.set(se.sessionId, bucket);
    }

    for (const s of recent7) {
      const ses = seBySession.get(s.id) ?? [];
      const muscles: string[] = [];
      let totalSets = 0;
      let totalVolume = 0;
      const exercises: CoachContext['recentSessions'][number]['exercises'] = [];

      for (const se of ses) {
        const ex = recentExMap.get(se.exerciseId);
        const exName = ex?.name ?? 'Unknown';
        const musclePrimary = ex?.musclePrimary ?? [];
        if (musclePrimary[0] && !muscles.includes(musclePrimary[0])) muscles.push(musclePrimary[0]);

        const activeSets = (setsBySE.get(se.id) ?? []).filter((st) => !st.isDeleted).sort((a, b) => a.setNumber - b.setNumber);
        totalSets += activeSets.length;
        totalVolume += activeSets.reduce((acc, st) => acc + st.reps * st.weight, 0);
        exercises.push({
          name: exName,
          sets: activeSets.map((st) => ({ reps: st.reps, weight: st.weight, unit: st.unit, isWarmup: st.isWarmup })),
        });
      }

      const durationMin = s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : null;
      recentSessions.push({
        date: new Date(s.startedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        durationMin,
        sets: totalSets,
        volume: totalVolume,
        muscles,
        exercises,
      });
    }
  }

  // ── Today's nutrition ──────────────────────────────────────────────────────
  const todayLogs = await foodCol
    .query(Q.where('user_id', userId), Q.where('date', todayStr), Q.where('is_deleted', false))
    .fetch();
  const nutritionToday = todayLogs.reduce(
    (acc, l) => ({ calories: acc.calories + l.caloriesKcal, protein: acc.protein + l.proteinG, carbs: acc.carbs + l.carbsG, fat: acc.fat + l.fatG }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  // ── Latest body weight ─────────────────────────────────────────────────────
  const bwLogs = await bwCol
    .query(Q.where('user_id', userId), Q.where('is_deleted', false), Q.sortBy('logged_at', Q.desc))
    .fetch();
  const latestBW = bwLogs[0] ?? null;

  return {
    displayName,
    unitPreference: unitPref,
    primaryGoal: profile?.primary_goal ?? null,
    experienceLevel: profile?.experience_level ?? null,
    trainingDaysPerWeek: profile?.training_days_per_week ?? null,
    heightCm: profile?.height_cm ?? null,
    bodyWeight: latestBW ? { weight: latestBW.weight, unit: latestBW.unit, date: latestBW.date } : null,
    streak,
    sessionsThisWeek,
    prsByExercise,
    recentSessions,
    nutritionToday,
    ...goals,
  };
}

export default function CoachScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, displayName, unitPreference } = useAuthStore();
  const { calorieGoal, proteinGoal, carbsGoal, fatGoal } = useSettingsStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [context, setContext] = useState<CoachContext | null>(null);
  const [messagesUsed, setMessagesUsed] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_entitlements')
      .select('tier')
      .eq('user_id', user.id)
      .eq('tier', 'ai')
      .maybeSingle()
      .then(({ data }) => setEntitled(!!data));

    loadCoachContext(user.id, displayName, unitPreference, { calorieGoal, proteinGoal, carbsGoal, fatGoal })
      .then(setContext)
      .catch(() => {});
  }, [user, displayName, unitPreference, calorieGoal, proteinGoal, carbsGoal, fatGoal]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setSending(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { message: msg, history, context: context ?? {} },
      });

      if (error) {
        if (error.message?.includes('subscription_required')) {
          setEntitled(false);
          setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
          return;
        }
        throw error;
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply ?? 'No response received.',
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (data.messagesUsed) setMessagesUsed(data.messagesUsed);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: "Sorry, I couldn't connect. Please try again." },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, messages, sending, context]);

  const handleUpgrade = () => {
    Alert.alert(
      'Upgrade to AI Coach',
      'Get unlimited access to your personal AI coach for training advice, program generation, and more.\n\nSubscription coming soon via in-app purchase.',
      [{ text: 'OK' }],
    );
  };

  // Loading entitlement
  if (entitled === null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: spacing[5], paddingBottom: spacing[3], borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginLeft: spacing[3] }}>AI Coach</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      </View>
    );
  }

  // Paywall
  if (!entitled) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: spacing[5], paddingBottom: spacing[3], borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginLeft: spacing[3] }}>AI Coach</Text>
        </View>
        <View style={[styles.center, { paddingHorizontal: spacing[6] }]}>
          <Text style={{ fontSize: 48, marginBottom: spacing[5] }}>🤖</Text>
          <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center', marginBottom: spacing[3] }}>
            Your Personal AI Coach
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: 'center', lineHeight: 22, marginBottom: spacing[6] }}>
            Get personalised training advice, program generation, nutrition guidance, and more — powered by Claude AI.
          </Text>
          {[
            'Personalised programs based on your PRs',
            'Chat about training, nutrition, recovery',
            'Plateau-busting advice with your data',
            '30 messages per day',
          ].map((feat) => (
            <View key={feat} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3], width: '100%' }}>
              <Text style={{ color: colors.text, marginRight: spacing[3] }}>✓</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{feat}</Text>
            </View>
          ))}
          <Pressable
            onPress={handleUpgrade}
            style={({ pressed }) => [{ backgroundColor: colors.text, borderRadius: radius.xl, paddingVertical: spacing[4], paddingHorizontal: spacing[8], marginTop: spacing[4], opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={{ color: colors.background, fontSize: fontSize.base, fontWeight: fontWeight.bold, textAlign: 'center' }}>
              Upgrade to AI Coach
            </Text>
          </Pressable>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing[3] }}>~$7.99/month</Text>
        </View>
      </View>
    );
  }

  // Chat UI
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: spacing[5], paddingBottom: spacing[3], borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: spacing[3] }}>
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>AI Coach</Text>
          {messagesUsed > 0 && (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{messagesUsed}/20 today</Text>
          )}
        </View>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 }}>
          <Text style={{ color: colors.textMuted, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 }}>PRO</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing[5], paddingBottom: spacing[3] }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', marginTop: spacing[8] }}>
            <Text style={{ fontSize: 40, marginBottom: spacing[4] }}>🤖</Text>
            <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginBottom: spacing[2], textAlign: 'center' }}>
              Hey{displayName ? ` ${displayName}` : ''}!
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing[6] }}>
              I know your workout history and PRs. Ask me anything.
            </Text>
            {QUICK_PROMPTS.map((p) => (
              <Pressable
                key={p}
                onPress={() => send(p)}
                style={({ pressed }) => [{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginBottom: spacing[2], width: '100%', opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: colors.text, fontSize: fontSize.sm }}>{p}</Text>
              </Pressable>
            ))}
          </View>
        )}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              {
                alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: item.role === 'user' ? colors.text : colors.surface,
                borderRadius: radius.xl,
                padding: spacing[4],
                maxWidth: '85%',
                marginBottom: spacing[3],
              },
            ]}
          >
            <Text style={{ color: item.role === 'user' ? colors.background : colors.text, fontSize: fontSize.base, lineHeight: 22 }}>
              {item.content}
            </Text>
          </View>
        )}
        ListFooterComponent={sending ? (
          <View style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[3] }]}>
            <ActivityIndicator size="small" color={colors.textMuted} />
          </View>
        ) : null}
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { borderTopColor: colors.border, paddingHorizontal: spacing[4], paddingVertical: spacing[3], paddingBottom: insets.bottom + spacing[3] }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask your coach..."
          placeholderTextColor={colors.textMuted}
          multiline
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, fontSize: fontSize.base, borderRadius: radius.xl, paddingHorizontal: spacing[4], paddingVertical: spacing[3], flex: 1, maxHeight: 120 }]}
          onSubmitEditing={() => send()}
          returnKeyType="send"
          blurOnSubmit
        />
        <Pressable
          onPress={() => send()}
          disabled={!input.trim() || sending}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: input.trim() && !sending ? colors.text : colors.surface,
              borderRadius: radius.xl,
              width: 44,
              height: 44,
              marginLeft: spacing[3],
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={{ color: input.trim() && !sending ? colors.background : colors.textMuted, fontSize: fontSize.base, fontWeight: fontWeight.bold }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bubble: {},
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 1 },
  input: {},
  sendBtn: { alignItems: 'center', justifyContent: 'center' },
});
