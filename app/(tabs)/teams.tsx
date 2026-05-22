import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Clipboard,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase/client';

interface Member {
  userId: string;
  displayName: string | null;
  role: string;
  sessionsThisWeek: number;
  lastWorkoutAt: string | null;
}

interface TeamData {
  id: string;
  name: string;
  inviteCode: string;
  role: string;
  members: Member[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function initials(name: string | null, userId: string): string {
  if (name?.trim()) return name.trim()[0].toUpperCase();
  return userId[0].toUpperCase();
}

export default function TeamsTab() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, displayName } = useAuthStore();
  const s = spacing;

  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const [nudging, setNudging] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) { setTeam(null); return; }

      const { data: teamRow } = await supabase
        .from('teams')
        .select('id, name, invite_code')
        .eq('id', membership.team_id)
        .maybeSingle();

      if (!teamRow) { setTeam(null); return; }

      const { data: allMembers } = await supabase
        .from('team_members')
        .select('user_id, role')
        .eq('team_id', teamRow.id);

      const memberUserIds = (allMembers ?? []).map((m) => m.user_id);

      const [usersRes, sessionsRes] = await Promise.all([
        supabase.from('users').select('id, display_name').in('id', memberUserIds),
        supabase
          .from('workout_sessions')
          .select('user_id, ended_at')
          .in('user_id', memberUserIds)
          .not('ended_at', 'is', null)
          .gte('started_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const userMap = new Map((usersRes.data ?? []).map((u) => [u.id, u.display_name]));
      const sessionCountMap = new Map<string, number>();
      const lastWorkoutMap = new Map<string, string>();
      for (const sess of (sessionsRes.data ?? [])) {
        sessionCountMap.set(sess.user_id, (sessionCountMap.get(sess.user_id) ?? 0) + 1);
        const prev = lastWorkoutMap.get(sess.user_id);
        if (!prev || (sess.ended_at ?? '') > prev) lastWorkoutMap.set(sess.user_id, sess.ended_at ?? '');
      }

      const members: Member[] = (allMembers ?? []).map((m) => ({
        userId: m.user_id,
        displayName: userMap.get(m.user_id) ?? null,
        role: m.role,
        sessionsThisWeek: sessionCountMap.get(m.user_id) ?? 0,
        lastWorkoutAt: lastWorkoutMap.get(m.user_id) ?? null,
      }));

      members.sort((a, b) => b.sessionsThisWeek - a.sessionsThisWeek || (a.displayName ?? '').localeCompare(b.displayName ?? ''));

      setTeam({ id: teamRow.id, name: teamRow.name, inviteCode: teamRow.invite_code, role: membership.role, members });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreate = async () => {
    if (!user || !createName.trim()) return;
    setCreating(true);
    try {
      const { data: newTeam, error: teamErr } = await supabase
        .from('teams')
        .insert({ name: createName.trim(), created_by: user.id })
        .select()
        .single();
      if (teamErr || !newTeam) { Alert.alert('Error', teamErr?.message ?? 'Could not create team'); return; }
      const { error: memberErr } = await supabase
        .from('team_members')
        .insert({ team_id: newTeam.id, user_id: user.id, role: 'admin' });
      if (memberErr) { Alert.alert('Error', memberErr.message); return; }
      setShowCreate(false);
      setCreateName('');
      load();
    } finally { setCreating(false); }
  };

  const handleJoin = async () => {
    if (!user || !joinCode.trim()) return;
    setJoining(true);
    try {
      const code = joinCode.trim().toUpperCase();
      const { data: found, error: findErr } = await supabase
        .from('teams')
        .select('id, name')
        .eq('invite_code', code)
        .maybeSingle();
      if (findErr || !found) { Alert.alert('Not found', 'No team with that invite code.'); return; }
      const { error: memberErr } = await supabase
        .from('team_members')
        .insert({ team_id: found.id, user_id: user.id, role: 'member' });
      if (memberErr?.code === '23505') { Alert.alert('Already a member', "You're already in this team."); return; }
      if (memberErr) { Alert.alert('Error', memberErr.message); return; }
      setShowJoin(false);
      setJoinCode('');
      load();
    } finally { setJoining(false); }
  };

  const handleLeave = () => {
    Alert.alert('Leave team', 'Are you sure you want to leave this team?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          if (!user || !team) return;
          await supabase.from('team_members').delete().eq('team_id', team.id).eq('user_id', user.id);
          setTeam(null);
          load();
        },
      },
    ]);
  };

  const handleNudge = async (member: Member) => {
    if (!user || !team || nudging) return;
    setNudging(member.userId);
    try {
      await supabase.from('team_nudges').insert({
        team_id: team.id,
        from_user_id: user.id,
        to_user_id: member.userId,
      });
      Alert.alert('Nudge sent!', `${member.displayName ?? 'Your teammate'} got a nudge. 💪`);
    } catch {
      Alert.alert('Error', 'Could not send nudge');
    } finally { setNudging(null); }
  };

  if (!user) return null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + s[5], paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, paddingHorizontal: s[5], marginBottom: s[5] }}>
        Teams
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.text} style={{ marginTop: s[10] }} />
      ) : team ? (
        <TeamView
          team={team}
          currentUserId={user.id}
          onNudge={handleNudge}
          nudging={nudging}
          onLeave={handleLeave}
          colors={colors}
          fontSize={fontSize}
          fontWeight={fontWeight}
          spacing={s}
          radius={radius}
        />
      ) : (
        <NoTeamView
          showCreate={showCreate}
          createName={createName}
          onCreateNameChange={setCreateName}
          onStartCreate={() => { setShowCreate(true); setShowJoin(false); }}
          onCancelCreate={() => { setShowCreate(false); setCreateName(''); }}
          onConfirmCreate={handleCreate}
          creating={creating}
          showJoin={showJoin}
          joinCode={joinCode}
          onJoinCodeChange={setJoinCode}
          onStartJoin={() => { setShowJoin(true); setShowCreate(false); }}
          onCancelJoin={() => { setShowJoin(false); setJoinCode(''); }}
          onConfirmJoin={handleJoin}
          joining={joining}
          colors={colors}
          fontSize={fontSize}
          fontWeight={fontWeight}
          spacing={s}
          radius={radius}
        />
      )}
    </ScrollView>
  );
}

// ─── No Team View ─────────────────────────────────────────────────────────────

function NoTeamView({
  showCreate, createName, onCreateNameChange, onStartCreate, onCancelCreate, onConfirmCreate, creating,
  showJoin, joinCode, onJoinCodeChange, onStartJoin, onCancelJoin, onConfirmJoin, joining,
  colors, fontSize, fontWeight, spacing, radius,
}: any) {
  const s = spacing;
  return (
    <View style={{ paddingHorizontal: s[5] }}>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: s[6], lineHeight: 20 }}>
        Create a team to track workouts together and keep each other accountable.
      </Text>

      {/* Create */}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, marginBottom: s[4], overflow: 'hidden' }}>
        {showCreate ? (
          <View style={{ padding: s[4] }}>
            <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold, marginBottom: s[3] }}>Team name</Text>
            <TextInput
              value={createName}
              onChangeText={onCreateNameChange}
              placeholder="e.g. Morning Crew"
              placeholderTextColor={colors.textMuted}
              autoFocus
              style={{ color: colors.text, fontSize: fontSize.base, backgroundColor: colors.background, borderRadius: radius.lg, paddingHorizontal: s[3], paddingVertical: s[2], marginBottom: s[3] }}
            />
            <View style={{ flexDirection: 'row', gap: s[3], justifyContent: 'flex-end' }}>
              <Pressable onPress={onCancelCreate} hitSlop={8}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onConfirmCreate} disabled={creating || !createName.trim()} hitSlop={8}>
                {creating ? <ActivityIndicator size="small" color={colors.text} /> : (
                  <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Create</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={onStartCreate} style={{ padding: s[4], flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', marginRight: s[3] }}>
              <Text style={{ fontSize: 18 }}>+</Text>
            </View>
            <View>
              <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>Create a team</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>Start a new team and invite friends</Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* Join */}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden' }}>
        {showJoin ? (
          <View style={{ padding: s[4] }}>
            <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold, marginBottom: s[3] }}>Invite code</Text>
            <TextInput
              value={joinCode}
              onChangeText={(t) => onJoinCodeChange(t.toUpperCase())}
              placeholder="e.g. ABC123"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoFocus
              maxLength={6}
              style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold, backgroundColor: colors.background, borderRadius: radius.lg, paddingHorizontal: s[3], paddingVertical: s[2], marginBottom: s[3], letterSpacing: 4 }}
            />
            <View style={{ flexDirection: 'row', gap: s[3], justifyContent: 'flex-end' }}>
              <Pressable onPress={onCancelJoin} hitSlop={8}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onConfirmJoin} disabled={joining || joinCode.length < 6} hitSlop={8}>
                {joining ? <ActivityIndicator size="small" color={colors.text} /> : (
                  <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Join</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={onStartJoin} style={{ padding: s[4], flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', marginRight: s[3] }}>
              <Text style={{ fontSize: 18 }}>→</Text>
            </View>
            <View>
              <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>Join a team</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>Enter an invite code from a teammate</Text>
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Team View ────────────────────────────────────────────────────────────────

function TeamView({
  team, currentUserId, onNudge, nudging, onLeave,
  colors, fontSize, fontWeight, spacing, radius,
}: {
  team: TeamData;
  currentUserId: string;
  onNudge: (m: Member) => void;
  nudging: string | null;
  onLeave: () => void;
  colors: any; fontSize: any; fontWeight: any; spacing: any; radius: any;
}) {
  const s = spacing;
  const totalSessions = team.members.reduce((acc, m) => acc + m.sessionsThisWeek, 0);

  return (
    <View style={{ paddingHorizontal: s[5] }}>
      {/* Team header */}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: s[4], marginBottom: s[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>{team.name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 }}>
              {team.members.length} {team.members.length === 1 ? 'member' : 'members'} · {totalSessions} workouts this week
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Clipboard.setString(team.inviteCode);
              Alert.alert('Copied!', `Invite code ${team.inviteCode} copied.`);
            }}
            style={{ backgroundColor: colors.background, borderRadius: radius.lg, paddingHorizontal: s[3], paddingVertical: s[2] }}
          >
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Invite code</Text>
            <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, letterSpacing: 3 }}>{team.inviteCode}</Text>
          </Pressable>
        </View>
      </View>

      {/* Leaderboard */}
      <Text style={[styles.eyebrow, { color: colors.textMuted, marginBottom: s[2] }]}>THIS WEEK</Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, marginBottom: s[5], overflow: 'hidden' }}>
        {team.members.map((member, i) => {
          const isMe = member.userId === currentUserId;
          const maxSessions = Math.max(...team.members.map((m) => m.sessionsThisWeek), 1);
          const barPct = member.sessionsThisWeek / maxSessions;
          return (
            <View key={member.userId}>
              {i > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginLeft: s[4] }} />}
              <View style={{ padding: s[4] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: member.sessionsThisWeek > 0 ? s[2] : 0 }}>
                  {/* Rank */}
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, width: 20, textAlign: 'center' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </Text>
                  {/* Avatar initial */}
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', marginHorizontal: s[3] }}>
                    <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                      {initials(member.displayName, member.userId)}
                    </Text>
                  </View>
                  {/* Name + last workout */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: isMe ? colors.text : colors.text, fontSize: fontSize.base, fontWeight: isMe ? fontWeight.semibold : fontWeight.normal }}>
                      {member.displayName ?? 'Member'}{isMe ? ' (you)' : ''}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 10 }}>
                      Last: {fmtDate(member.lastWorkoutAt)}
                    </Text>
                  </View>
                  {/* Sessions count */}
                  <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginRight: s[3] }}>
                    {member.sessionsThisWeek}
                  </Text>
                  {/* Nudge */}
                  {!isMe && (
                    <Pressable
                      onPress={() => onNudge(member)}
                      disabled={!!nudging}
                      style={{ backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: s[2], paddingVertical: 4 }}
                    >
                      {nudging === member.userId ? (
                        <ActivityIndicator size="small" color={colors.text} />
                      ) : (
                        <Text style={{ fontSize: 14 }}>💪</Text>
                      )}
                    </Pressable>
                  )}
                </View>
                {/* Progress bar */}
                {member.sessionsThisWeek > 0 && (
                  <View style={{ height: 3, backgroundColor: colors.background, borderRadius: 2, marginLeft: 20 + s[3] + 32 + s[3] }}>
                    <View style={{ height: 3, width: `${barPct * 100}%`, backgroundColor: colors.success, borderRadius: 2 }} />
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Leave team */}
      <Pressable
        onPress={onLeave}
        style={({ pressed }) => ({ backgroundColor: colors.error + '18', borderRadius: radius.lg, paddingVertical: s[4], opacity: pressed ? 0.7 : 1 })}
      >
        <Text style={{ color: colors.error, fontSize: fontSize.base, textAlign: 'center' }}>Leave team</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 4 },
});
