import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an expert fitness coach built into the Pumped workout tracking app. You help users with:
- Exercise programming, progression, and periodisation
- Form cues and exercise technique
- Recovery, deload weeks, and injury prevention
- Nutrition: macros, meal timing, supplements
- Motivation and building sustainable habits

Guidelines:
- Keep replies concise and actionable (3-5 sentences unless a detailed breakdown is asked for)
- Use the user's workout context when provided to give personalised advice
- Reference specific numbers (weights, reps, sets) from their data when relevant
- Never recommend anything extreme or unsafe
- Suggest seeing a doctor or physio for medical/injury concerns
- Use a direct, encouraging tone — like a knowledgeable training partner`;

const MSG_LIMIT = 20;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS });

    // Check AI entitlement
    const { data: entitlement } = await supabase
      .from('user_entitlements')
      .select('tier')
      .eq('user_id', user.id)
      .eq('tier', 'ai')
      .maybeSingle();

    if (!entitlement) {
      return new Response(
        JSON.stringify({ error: 'subscription_required' }),
        { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const { message, history = [], context = {} } = await req.json();
    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'No message' }), { status: 400, headers: CORS });
    }
    if (history.length > MSG_LIMIT * 2) {
      return new Response(
        JSON.stringify({ error: 'daily_limit_reached' }),
        { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // Build system prompt with full user context
    let systemPrompt = SYSTEM_PROMPT;
    systemPrompt += '\n\n--- User Context ---';

    if (context.displayName) systemPrompt += `\nName: ${context.displayName}`;
    if (context.unitPreference) systemPrompt += `\nUnit preference: ${context.unitPreference}`;
    if (context.primaryGoal) systemPrompt += `\nPrimary goal: ${context.primaryGoal}`;
    if (context.experienceLevel) systemPrompt += `\nExperience level: ${context.experienceLevel}`;
    if (context.trainingDaysPerWeek) systemPrompt += `\nTraining days/week: ${context.trainingDaysPerWeek}`;
    if (context.heightCm) systemPrompt += `\nHeight: ${context.heightCm} cm`;
    if (context.bodyWeight) {
      systemPrompt += `\nBody weight: ${context.bodyWeight.weight} ${context.bodyWeight.unit} (logged ${context.bodyWeight.date})`;
    }

    systemPrompt += `\nCurrent streak: ${context.streak ?? 0} day(s)`;
    systemPrompt += `\nSessions this week: ${context.sessionsThisWeek ?? 0}`;

    // Nutrition
    const nut = context.nutritionToday;
    if (nut) {
      systemPrompt += `\nToday's nutrition: ${Math.round(nut.calories)} kcal / ${Math.round(nut.protein)}g protein / ${Math.round(nut.carbs)}g carbs / ${Math.round(nut.fat)}g fat`;
    }
    if (context.calorieGoal) {
      systemPrompt += `\nNutrition goals: ${context.calorieGoal} kcal / ${context.proteinGoal}g protein / ${context.carbsGoal}g carbs / ${context.fatGoal}g fat`;
    }

    // PRs
    if (context.prsByExercise?.length) {
      systemPrompt += '\n\nPersonal Records:';
      for (const ex of (context.prsByExercise as any[]).slice(0, 12)) {
        const recordStrs = (ex.records as any[]).map((r: any) => `${r.reps}RM: ${r.weight}${r.unit}`).join(', ');
        systemPrompt += `\n  ${ex.exercise} (${(ex.muscles as string[]).join('/')}): ${recordStrs}`;
      }
    }

    // Recent sessions with full exercise detail
    if (context.recentSessions?.length) {
      systemPrompt += '\n\nLast 7 sessions:';
      for (const s of (context.recentSessions as any[]).slice(0, 7)) {
        const dur = s.durationMin ? ` ${s.durationMin}min` : '';
        systemPrompt += `\n  ${s.date}${dur} | ${s.sets} sets | ${s.volume > 0 ? `${s.volume.toLocaleString()} vol` : ''} | muscles: ${(s.muscles as string[]).join(', ') || 'unknown'}`;
        for (const ex of (s.exercises as any[])) {
          const setStrs = (ex.sets as any[]).map((st: any) => st.isWarmup ? `W:${st.reps}×${st.weight}` : `${st.reps}×${st.weight}${st.unit}`).join(', ');
          systemPrompt += `\n    • ${ex.name}: ${setStrs}`;
        }
      }
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    // Keep only the last 6 exchanges (12 messages) to cap token cost
    const trimmedHistory = history.slice(-12);

    const messages = [
      ...trimmedHistory.map((h: { role: string; content: string }) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0]?.type === 'text' ? response.content[0].text : '';

    return new Response(
      JSON.stringify({ reply, messagesUsed: Math.floor(history.length / 2) + 1, limit: MSG_LIMIT }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[ai-chat]', err);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
