import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, Camera, BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase/client';
import { database } from '@/lib/watermelon/database';
import type { FoodLog, Food } from '@/lib/watermelon/models';
import { Eyebrow } from '@/components/ui';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type Mode = 'search' | 'scan' | 'photo';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
};

interface FoodResult {
  name: string;
  brand: string | null;
  barcode: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  isLocal?: boolean;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function macrosFromPer100g(food: FoodResult, grams: number) {
  const f = grams / 100;
  return {
    calories: Math.round(food.caloriesPer100g * f),
    protein: Math.round(food.proteinPer100g * f * 10) / 10,
    carbs: Math.round(food.carbsPer100g * f * 10) / 10,
    fat: Math.round(food.fatPer100g * f * 10) / 10,
  };
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, value, onChangeText, placeholder, keyboardType, colors, fontSize, spacing, radius }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder: string;
  keyboardType?: 'default' | 'decimal-pad'; colors: any; fontSize: any; spacing: any; radius: any;
}) {
  return (
    <View style={{ marginBottom: spacing[3] }}>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing[1] }}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={colors.textMuted} keyboardType={keyboardType ?? 'default'}
        style={{ backgroundColor: colors.surface, color: colors.text, fontSize: fontSize.base, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[3] }}
      />
    </View>
  );
}

// ─── Entry form ───────────────────────────────────────────────────────────────

function EntryForm({ initial, onLog, colors, fontSize, fontWeight, spacing, radius }: {
  initial?: Partial<{ name: string; servingG: string; calories: string; protein: string; carbs: string; fat: string; aiNote: string }>;
  onLog: (vals: { name: string; servingG: number; calories: number; protein: number; carbs: number; fat: number }) => Promise<void>;
  colors: any; fontSize: any; fontWeight: any; spacing: any; radius: any;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [servingG, setServingG] = useState(initial?.servingG ?? '100');
  const [calories, setCalories] = useState(initial?.calories ?? '');
  const [protein, setProtein] = useState(initial?.protein ?? '');
  const [carbs, setCarbs] = useState(initial?.carbs ?? '');
  const [fat, setFat] = useState(initial?.fat ?? '');
  const [saving, setSaving] = useState(false);

  // When initial values change (e.g. food selected from search), sync state
  const prevInitial = useRef(initial);
  useEffect(() => {
    if (initial && initial !== prevInitial.current) {
      prevInitial.current = initial;
      if (initial.name !== undefined) setName(initial.name);
      if (initial.servingG !== undefined) setServingG(initial.servingG);
      if (initial.calories !== undefined) setCalories(initial.calories);
      if (initial.protein !== undefined) setProtein(initial.protein);
      if (initial.carbs !== undefined) setCarbs(initial.carbs);
      if (initial.fat !== undefined) setFat(initial.fat);
    }
  }, [initial]);

  const canLog = name.trim().length > 0 && calories.length > 0;

  const handleLog = async () => {
    if (!canLog || saving) return;
    setSaving(true);
    try {
      await onLog({ name: name.trim(), servingG: parseFloat(servingG) || 100, calories: parseFloat(calories) || 0, protein: parseFloat(protein) || 0, carbs: parseFloat(carbs) || 0, fat: parseFloat(fat) || 0 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      {initial?.aiNote && (
        <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: spacing[3], marginBottom: spacing[3], flexDirection: 'row', gap: spacing[2] }}>
          <Text style={{ fontSize: 14 }}>✨</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, flex: 1, lineHeight: 18 }}>{initial.aiNote}</Text>
        </View>
      )}
      <Field label="Food name *" value={name} onChangeText={setName} placeholder="e.g. Chicken breast" colors={colors} fontSize={fontSize} spacing={spacing} radius={radius} />
      <Field label="Serving size (g)" value={servingG} onChangeText={setServingG} placeholder="100" keyboardType="decimal-pad" colors={colors} fontSize={fontSize} spacing={spacing} radius={radius} />
      <Field label="Calories (kcal) *" value={calories} onChangeText={setCalories} placeholder="0" keyboardType="decimal-pad" colors={colors} fontSize={fontSize} spacing={spacing} radius={radius} />
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        <View style={{ flex: 1 }}><Field label="Protein (g)" value={protein} onChangeText={setProtein} placeholder="0" keyboardType="decimal-pad" colors={colors} fontSize={fontSize} spacing={spacing} radius={radius} /></View>
        <View style={{ flex: 1 }}><Field label="Carbs (g)" value={carbs} onChangeText={setCarbs} placeholder="0" keyboardType="decimal-pad" colors={colors} fontSize={fontSize} spacing={spacing} radius={radius} /></View>
        <View style={{ flex: 1 }}><Field label="Fat (g)" value={fat} onChangeText={setFat} placeholder="0" keyboardType="decimal-pad" colors={colors} fontSize={fontSize} spacing={spacing} radius={radius} /></View>
      </View>
      <Pressable
        onPress={handleLog} disabled={!canLog || saving}
        style={({ pressed }) => [{ backgroundColor: canLog ? colors.text : colors.surface, borderRadius: 10, paddingVertical: spacing[4], alignItems: 'center', opacity: pressed || saving ? 0.7 : 1, marginTop: spacing[2] }]}
      >
        {saving ? <ActivityIndicator color={colors.background} /> : (
          <Text style={{ color: canLog ? colors.background : colors.textMuted, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>Log Food</Text>
        )}
      </Pressable>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LogFoodScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { meal, date } = useLocalSearchParams<{ meal: MealType; date: string }>();

  const [mode, setMode] = useState<Mode>('search');

  // Search mode
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<{ food: FoodResult; servingG: string } | null>(null);
  const [formInitial, setFormInitial] = useState<Parameters<typeof EntryForm>[0]['initial']>(undefined);

  // Scan mode
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<FoodResult | null>(null);

  // Photo mode
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoResult, setPhotoResult] = useState<Parameters<typeof EntryForm>[0]['initial'] | null>(null);

  // Request camera permission when scan/photo mode selected
  useEffect(() => {
    if ((mode === 'scan' || mode === 'photo') && cameraPermission === null) {
      Camera.requestCameraPermissionsAsync().then(({ status }) => setCameraPermission(status === 'granted'));
    }
  }, [mode, cameraPermission]);

  // Open Food Facts search (debounced)
  useEffect(() => {
    if (mode !== 'search') return;
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        // Local DB first
        const foodsCol = database.collections.get<Food>('foods');
        const local = await foodsCol.query(Q.where('name', Q.like(`%${Q.sanitizeLikeString(searchQuery)}%`))).fetch();
        const localResults: FoodResult[] = local.map((f) => ({
          name: f.name, brand: null, barcode: f.barcode,
          caloriesPer100g: f.caloriesPer100g, proteinPer100g: f.proteinPer100g,
          carbsPer100g: f.carbsPer100g, fatPer100g: f.fatPer100g, isLocal: true,
        }));

        // Remote Open Food Facts via direct fetch (invoke doesn't support GET query params)
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const res = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/food-search?q=${encodeURIComponent(searchQuery)}`,
          { headers: { Authorization: `Bearer ${token}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY! } },
        );
        const remote = res.ok ? (await res.json()).results ?? [] : [];

        // Merge: local first, then remote (deduplicate by name)
        const seen = new Set(localResults.map((r) => r.name.toLowerCase()));
        const merged = [...localResults, ...remote.filter((r: FoodResult) => !seen.has(r.name.toLowerCase()))];
        setSearchResults(merged);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, mode]);

  const handleSelectFood = (food: FoodResult) => {
    const g = 100;
    const m = macrosFromPer100g(food, g);
    setFormInitial({
      name: food.brand ? `${food.name} (${food.brand})` : food.name,
      servingG: String(g),
      calories: String(m.calories),
      protein: String(m.protein),
      carbs: String(m.carbs),
      fat: String(m.fat),
    });
    setSelectedFood({ food, servingG: String(g) });
    setSearchResults([]);
    setSearchQuery('');
  };

  // Barcode scanned
  const handleBarcode = useCallback(async (result: BarcodeScanningResult) => {
    if (scanned || scanLoading) return;
    setScanned(true);
    setScanLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/food-search?barcode=${encodeURIComponent(result.data)}`,
        { headers: { Authorization: `Bearer ${token}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY! } },
      );
      const json = res.ok ? await res.json() : null;
      const foods: FoodResult[] = json?.results ?? [];
      if (foods.length > 0) {
        setScanResult(foods[0]);
      } else {
        Alert.alert('Not found', `Barcode ${result.data} wasn't found in the food database.`, [
          { text: 'Try again', onPress: () => { setScanned(false); setScanResult(null); } },
          { text: 'Enter manually', onPress: () => { setMode('search'); setScanned(false); } },
        ]);
      }
    } finally {
      setScanLoading(false);
    }
  }, [scanned, scanLoading]);

  const handleUseScanResult = () => {
    if (!scanResult) return;
    const m = macrosFromPer100g(scanResult, 100);
    setFormInitial({
      name: scanResult.brand ? `${scanResult.name} (${scanResult.brand})` : scanResult.name,
      servingG: '100',
      calories: String(m.calories),
      protein: String(m.protein),
      carbs: String(m.carbs),
      fat: String(m.fat),
    });
    setMode('search');
    setScanResult(null);
    setScanned(false);
  };

  // AI photo analysis
  const handlePickPhoto = async (useCamera: boolean) => {
    let result;
    if (useCamera) {
      result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6, allowsEditing: true, aspect: [4, 3] });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, allowsEditing: true, aspect: [4, 3], mediaTypes: 'images' });
    }
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    setPhotoLoading(true);
    setPhotoResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-food-scan', {
        body: { imageBase64: asset.base64, mimeType: 'image/jpeg' },
      });

      if (data?.error === 'subscription_required' || error?.message?.includes('subscription_required')) {
        Alert.alert(
          'Free scans used up',
          "You've used your 3 lifetime free photo scans. Upgrade to AI Coach for 10 photo scans per day.",
          [{ text: 'OK' }],
        );
        setPhotoUri(null);
        return;
      }

      if (data?.error === 'daily_limit_reached') {
        Alert.alert(
          'Daily limit reached',
          `You've used all ${data.limit} photo scans for today. Resets at midnight.`,
          [{ text: 'OK' }],
        );
        setPhotoUri(null);
        return;
      }

      if (error) throw error;
      if (!data?.identified) {
        Alert.alert("Couldn't identify food", "The AI couldn't identify a food item in this photo. Try a clearer shot or enter manually.");
        setPhotoUri(null);
        return;
      }

      const confidenceLabel = data.confidence === 'high' ? '✓ High confidence' : data.confidence === 'medium' ? '~ Moderate confidence — verify values' : '⚠ Low confidence — please verify all values';
      setPhotoResult({
        name: data.food_name,
        servingG: String(data.estimated_weight_g),
        calories: String(data.calories_kcal),
        protein: String(data.protein_g),
        carbs: String(data.carbs_g),
        fat: String(data.fat_g),
        aiNote: `${confidenceLabel}. ${data.notes ?? ''}`.trim(),
      });
    } catch {
      Alert.alert('Error', 'Failed to analyze photo. Please try again or enter manually.');
      setPhotoUri(null);
    } finally {
      setPhotoLoading(false);
    }
  };

  // Log food to DB
  const handleLog = async (vals: { name: string; servingG: number; calories: number; protein: number; carbs: number; fat: number }) => {
    if (!user) return;
    const logsCol = database.collections.get<FoodLog>('food_logs');
    const foodsCol = database.collections.get<Food>('foods');
    const now = Date.now();

    await database.write(async () => {
      const existing = await foodsCol.query(Q.where('name', vals.name)).fetchCount();
      if (existing === 0) {
        const factor = 100 / vals.servingG;
        await foodsCol.create((r) => {
          r.name = vals.name;
          r.caloriesPer100g = vals.calories * factor;
          r.proteinPer100g = vals.protein * factor;
          r.carbsPer100g = vals.carbs * factor;
          r.fatPer100g = vals.fat * factor;
          r.isCustom = true;
          r.createdBy = user.id;
          r.remoteId = null;
          r.syncedAt = null;
        });
      }
      await logsCol.create((r) => {
        r.userId = user.id;
        r.foodName = vals.name;
        r.mealType = meal ?? 'snack';
        r.servingG = vals.servingG;
        r.caloriesKcal = vals.calories;
        r.proteinG = vals.protein;
        r.carbsG = vals.carbs;
        r.fatG = vals.fat;
        r.loggedAt = now;
        r.date = date ?? new Date().toISOString().split('T')[0];
        r.isDeleted = false;
        r.remoteId = null;
        r.syncedAt = null;
      });
    });

    router.back();
  };

  const modeBtn = (m: Mode, label: string, icon: string) => (
    <Pressable
      key={m}
      onPress={() => { setMode(m); setSearchResults([]); setScanResult(null); setScanned(false); }}
      style={[styles.modeTab, { backgroundColor: mode === m ? colors.text : colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[2] }]}
    >
      <Text style={{ color: mode === m ? colors.background : colors.textMuted, fontSize: fontSize.sm }}>{icon} {label}</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: spacing[5], paddingBottom: spacing[3], borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginLeft: spacing[3], flex: 1 }}>
          Log {MEAL_LABELS[meal ?? 'snack']}
        </Text>
      </View>

      {/* Mode tabs */}
      <View style={[styles.modeTabs, { paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderBottomColor: colors.border, gap: spacing[2] }]}>
        {modeBtn('search', 'Search', '🔍')}
        {modeBtn('scan', 'Barcode', '▦')}
        {modeBtn('photo', 'AI Photo', '📸')}
      </View>

      {/* ── SEARCH mode ──────────────────────────────────────────────────────── */}
      {mode === 'search' && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search Open Food Facts…"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            style={{ backgroundColor: colors.surface, color: colors.text, fontSize: fontSize.base, borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginBottom: spacing[2] }}
          />
          {searchLoading && <ActivityIndicator size="small" color={colors.textMuted} style={{ marginBottom: spacing[2] }} />}
          {searchResults.length > 0 && (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: spacing[4], overflow: 'hidden' }}>
              {searchResults.slice(0, 10).map((r, i) => (
                <Pressable
                  key={`${r.name}-${i}`}
                  onPress={() => handleSelectFood(r)}
                  style={({ pressed }) => [{ padding: spacing[3], borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center' }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: fontSize.base }}>{r.name}</Text>
                    {r.brand && <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{r.brand}</Text>}
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>
                      {r.caloriesPer100g} kcal · {r.proteinPer100g}g P · {r.carbsPer100g}g C · {r.fatPer100g}g F per 100g
                    </Text>
                  </View>
                  {r.isLocal && <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginLeft: spacing[2] }}>saved</Text>}
                </Pressable>
              ))}
            </View>
          )}

          <Eyebrow style={{ marginBottom: spacing[3] }}>{formInitial?.name ? 'Edit Details' : 'Manual Entry'}</Eyebrow>
          <EntryForm initial={formInitial} onLog={handleLog} colors={colors} fontSize={fontSize} fontWeight={fontWeight} spacing={spacing} radius={radius} />
        </ScrollView>
      )}

      {/* ── SCAN mode ────────────────────────────────────────────────────────── */}
      {mode === 'scan' && (
        <View style={{ flex: 1 }}>
          {cameraPermission === false ? (
            <View style={styles.center}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: 'center', paddingHorizontal: spacing[8] }}>
                Camera access is required for barcode scanning. Enable it in Settings.
              </Text>
            </View>
          ) : scanResult ? (
            <ScrollView contentContainerStyle={{ padding: spacing[5], paddingBottom: insets.bottom + 40 }}>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[5], marginBottom: spacing[4] }}>
                <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>{scanResult.name}</Text>
                {scanResult.brand && <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing[3] }}>{scanResult.brand}</Text>}
                <View style={{ flexDirection: 'row', gap: spacing[4], marginTop: spacing[2] }}>
                  {[['Calories', `${scanResult.caloriesPer100g} kcal`], ['Protein', `${scanResult.proteinPer100g}g`], ['Carbs', `${scanResult.carbsPer100g}g`], ['Fat', `${scanResult.fatPer100g}g`]].map(([l, v]) => (
                    <View key={l} style={{ alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>{v}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{l}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing[2] }}>Per 100g</Text>
              </View>
              <Pressable onPress={handleUseScanResult} style={({ pressed }) => [{ backgroundColor: colors.text, borderRadius: radius.xl, paddingVertical: spacing[4], alignItems: 'center', opacity: pressed ? 0.8 : 1, marginBottom: spacing[3] }]}>
                <Text style={{ color: colors.background, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>Use this food →</Text>
              </Pressable>
              <Pressable onPress={() => { setScanned(false); setScanResult(null); }} style={({ pressed }) => [{ alignItems: 'center', opacity: pressed ? 0.6 : 1 }]}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Scan again</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
                onBarcodeScanned={scanned ? undefined : handleBarcode}
              >
                {/* Scanning overlay */}
                <View style={styles.scanOverlay}>
                  <View style={{ flex: 1 }} />
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ flex: 1 }} />
                    <View style={[styles.scanFrame, { borderColor: colors.background }]} />
                    <View style={{ flex: 1 }} />
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: spacing[6] }}>
                    {scanLoading
                      ? <ActivityIndicator color="white" />
                      : <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: fontSize.sm }}>Point camera at barcode</Text>}
                  </View>
                </View>
              </CameraView>
            </View>
          )}
        </View>
      )}

      {/* ── PHOTO mode ───────────────────────────────────────────────────────── */}
      {mode === 'photo' && (
        <ScrollView contentContainerStyle={{ padding: spacing[5], paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          {photoLoading ? (
            <View style={[styles.center, { minHeight: 200 }]}>
              <ActivityIndicator color={colors.text} size="large" />
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing[3] }}>Analysing food…</Text>
            </View>
          ) : photoResult ? (
            <>
              {photoUri && <Image source={{ uri: photoUri }} style={{ width: '100%', height: 180, borderRadius: radius.xl, marginBottom: spacing[4], resizeMode: 'cover' }} />}
              <Eyebrow style={{ marginBottom: spacing[3] }}>Verify & Adjust</Eyebrow>
              <EntryForm initial={photoResult} onLog={handleLog} colors={colors} fontSize={fontSize} fontWeight={fontWeight} spacing={spacing} radius={radius} />
              <Pressable onPress={() => { setPhotoResult(null); setPhotoUri(null); }} style={({ pressed }) => [{ alignItems: 'center', marginTop: spacing[3], opacity: pressed ? 0.6 : 1 }]}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Try a different photo</Text>
              </Pressable>
            </>
          ) : (
            <View>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[6], alignItems: 'center', marginBottom: spacing[4] }}>
                <Text style={{ fontSize: 48, marginBottom: spacing[3] }}>📸</Text>
                <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold, textAlign: 'center', marginBottom: spacing[2] }}>
                  AI Food Recognition
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 }}>
                  Take a photo of your meal and AI will estimate the calories and macros. You&apos;ll be able to verify and adjust before logging.
                </Text>
              </View>
              <Pressable
                onPress={() => handlePickPhoto(true)}
                style={({ pressed }) => [{ backgroundColor: colors.text, borderRadius: radius.xl, paddingVertical: spacing[4], alignItems: 'center', marginBottom: spacing[3], opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={{ color: colors.background, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>Take Photo</Text>
              </Pressable>
              <Pressable
                onPress={() => handlePickPhoto(false)}
                style={({ pressed }) => [{ backgroundColor: colors.surface, borderRadius: radius.xl, paddingVertical: spacing[4], alignItems: 'center', opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={{ color: colors.text, fontSize: fontSize.base }}>Choose from Library</Text>
              </Pressable>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing[3] }}>
                3 free scans lifetime · 10/day with AI Coach
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  modeTabs: { flexDirection: 'row', borderBottomWidth: 1 },
  modeTab: {},
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  scanFrame: { width: 220, height: 140, borderWidth: 2, borderRadius: 8 },
});
