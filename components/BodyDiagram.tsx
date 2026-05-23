import Svg, { Path, Circle, Ellipse, Rect } from 'react-native-svg';
import { View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  primary: string[];
  secondary: string[];
  size?: number;
}

// Map muscle keys to which view they appear on and which path IDs to highlight
const FRONT_MUSCLES: Record<string, string[]> = {
  chest: ['chest_l', 'chest_r'],
  front_delt: ['front_delt_l', 'front_delt_r'],
  biceps: ['biceps_l', 'biceps_r'],
  brachialis: ['biceps_l', 'biceps_r'],
  triceps: ['triceps_l', 'triceps_r'],
  forearms: ['forearm_l', 'forearm_r'],
  core: ['core'],
  obliques: ['oblique_l', 'oblique_r'],
  quads: ['quad_l', 'quad_r'],
  calves: ['calf_front_l', 'calf_front_r'],
  hip_flexors: ['quad_l', 'quad_r'],
};

const BACK_MUSCLES: Record<string, string[]> = {
  traps: ['traps'],
  lats: ['lat_l', 'lat_r'],
  mid_back: ['mid_back'],
  lower_back: ['lower_back'],
  rear_delt: ['rear_delt_l', 'rear_delt_r'],
  triceps: ['triceps_back_l', 'triceps_back_r'],
  glutes: ['glute_l', 'glute_r'],
  hamstrings: ['hamstring_l', 'hamstring_r'],
  calves: ['calf_back_l', 'calf_back_r'],
};

function FrontBody({ primary, secondary, highlight, base, secondaryColor }: {
  primary: string[]; secondary: string[]; highlight: string; base: string; secondaryColor: string;
}) {
  const primaryIds = new Set(primary.flatMap(m => FRONT_MUSCLES[m] ?? []));
  const secondaryIds = new Set(secondary.flatMap(m => FRONT_MUSCLES[m] ?? []));

  const fill = (id: string) => {
    if (primaryIds.has(id)) return highlight;
    if (secondaryIds.has(id)) return secondaryColor;
    return base;
  };

  return (
    <Svg viewBox="0 0 50 110" width="100%" height="100%">
      {/* Head */}
      <Circle cx="25" cy="7" r="6" fill={base} />
      {/* Neck */}
      <Rect x="22" y="12.5" width="6" height="5" rx="1" fill={base} />
      {/* Torso outline */}
      <Path d="M15 18 Q10 22 10 40 L10 62 Q10 65 13 65 L37 65 Q40 65 40 62 L40 40 Q40 22 35 18 Z" fill={base} />
      {/* Chest L */}
      <Path id="chest_l" d="M15 22 Q12 25 12 33 Q16 37 22 36 L22 22 Z" fill={fill('chest_l')} />
      {/* Chest R */}
      <Path id="chest_r" d="M35 22 Q38 25 38 33 Q34 37 28 36 L28 22 Z" fill={fill('chest_r')} />
      {/* Front Delt L */}
      <Ellipse id="front_delt_l" cx="12" cy="22" rx="4" ry="5" fill={fill('front_delt_l')} />
      {/* Front Delt R */}
      <Ellipse id="front_delt_r" cx="38" cy="22" rx="4" ry="5" fill={fill('front_delt_r')} />
      {/* Core / Abs */}
      <Path id="core" d="M20 38 L20 60 L30 60 L30 38 Z" fill={fill('core')} />
      {/* Oblique L */}
      <Path id="oblique_l" d="M13 38 Q12 50 13 60 L20 60 L20 38 Z" fill={fill('oblique_l')} />
      {/* Oblique R */}
      <Path id="oblique_r" d="M37 38 Q38 50 37 60 L30 60 L30 38 Z" fill={fill('oblique_r')} />
      {/* Upper arm L */}
      <Path d="M6 26 Q4 32 5 42 L11 42 Q12 32 10 26 Z" fill={base} />
      {/* Biceps L */}
      <Path id="biceps_l" d="M6.5 28 Q5 33 6 40 L10 40 Q11 33 9.5 28 Z" fill={fill('biceps_l')} />
      {/* Triceps L */}
      <Path id="triceps_l" d="M5 30 Q4 37 5 42 L8 42 Q7.5 37 6.5 30 Z" fill={fill('triceps_l')} />
      {/* Forearm L */}
      <Rect id="forearm_l" x="5" y="43" width="6" height="14" rx="2" fill={fill('forearm_l')} />
      {/* Upper arm R */}
      <Path d="M44 26 Q46 32 45 42 L39 42 Q38 32 40 26 Z" fill={base} />
      {/* Biceps R */}
      <Path id="biceps_r" d="M43.5 28 Q45 33 44 40 L40 40 Q39 33 40.5 28 Z" fill={fill('biceps_r')} />
      {/* Triceps R */}
      <Path id="triceps_r" d="M45 30 Q46 37 45 42 L42 42 Q42.5 37 43.5 30 Z" fill={fill('triceps_r')} />
      {/* Forearm R */}
      <Rect id="forearm_r" x="39" y="43" width="6" height="14" rx="2" fill={fill('forearm_r')} />
      {/* Hip area */}
      <Path d="M13 65 L13 70 L37 70 L37 65 Z" fill={base} />
      {/* Quad L */}
      <Path id="quad_l" d="M13 70 Q11 78 12 92 L22 92 Q23 78 21 70 Z" fill={fill('quad_l')} />
      {/* Quad R */}
      <Path id="quad_r" d="M37 70 Q39 78 38 92 L28 92 Q27 78 29 70 Z" fill={fill('quad_r')} />
      {/* Knee L */}
      <Ellipse cx="17" cy="93" rx="5" ry="3" fill={base} />
      {/* Knee R */}
      <Ellipse cx="33" cy="93" rx="5" ry="3" fill={base} />
      {/* Shin L */}
      <Rect x="13" y="95" width="8" height="12" rx="2" fill={base} />
      {/* Shin R */}
      <Rect x="29" y="95" width="8" height="12" rx="2" fill={base} />
      {/* Calf front L */}
      <Ellipse id="calf_front_l" cx="17" cy="101" rx="4" ry="6" fill={fill('calf_front_l')} />
      {/* Calf front R */}
      <Ellipse id="calf_front_r" cx="33" cy="101" rx="4" ry="6" fill={fill('calf_front_r')} />
    </Svg>
  );
}

function BackBody({ primary, secondary, highlight, base, secondaryColor }: {
  primary: string[]; secondary: string[]; highlight: string; base: string; secondaryColor: string;
}) {
  const primaryIds = new Set(primary.flatMap(m => BACK_MUSCLES[m] ?? []));
  const secondaryIds = new Set(secondary.flatMap(m => BACK_MUSCLES[m] ?? []));

  const fill = (id: string) => {
    if (primaryIds.has(id)) return highlight;
    if (secondaryIds.has(id)) return secondaryColor;
    return base;
  };

  return (
    <Svg viewBox="0 0 50 110" width="100%" height="100%">
      {/* Head */}
      <Circle cx="25" cy="7" r="6" fill={base} />
      {/* Neck */}
      <Rect x="22" y="12.5" width="6" height="5" rx="1" fill={base} />
      {/* Torso back */}
      <Path d="M15 18 Q10 22 10 40 L10 62 Q10 65 13 65 L37 65 Q40 65 40 62 L40 40 Q40 22 35 18 Z" fill={base} />
      {/* Traps */}
      <Path id="traps" d="M15 18 Q18 14 25 13 Q32 14 35 18 L32 24 Q28 20 25 19 Q22 20 18 24 Z" fill={fill('traps')} />
      {/* Rear Delt L */}
      <Ellipse id="rear_delt_l" cx="12" cy="22" rx="4" ry="5" fill={fill('rear_delt_l')} />
      {/* Rear Delt R */}
      <Ellipse id="rear_delt_r" cx="38" cy="22" rx="4" ry="5" fill={fill('rear_delt_r')} />
      {/* Lat L */}
      <Path id="lat_l" d="M10 26 Q10 38 13 50 L20 48 Q16 36 14 26 Z" fill={fill('lat_l')} />
      {/* Lat R */}
      <Path id="lat_r" d="M40 26 Q40 38 37 50 L30 48 Q34 36 36 26 Z" fill={fill('lat_r')} />
      {/* Mid Back */}
      <Rect id="mid_back" x="18" y="26" width="14" height="18" rx="2" fill={fill('mid_back')} />
      {/* Lower Back */}
      <Rect id="lower_back" x="19" y="46" width="12" height="16" rx="2" fill={fill('lower_back')} />
      {/* Upper arm back L */}
      <Path d="M6 26 Q4 32 5 42 L11 42 Q12 32 10 26 Z" fill={base} />
      {/* Triceps back L */}
      <Path id="triceps_back_l" d="M5 28 Q4 35 5 42 L9 42 Q8.5 35 7 28 Z" fill={fill('triceps_back_l')} />
      {/* Forearm back L */}
      <Rect x="5" y="43" width="6" height="14" rx="2" fill={base} />
      {/* Upper arm back R */}
      <Path d="M44 26 Q46 32 45 42 L39 42 Q38 32 40 26 Z" fill={base} />
      {/* Triceps back R */}
      <Path id="triceps_back_r" d="M45 28 Q46 35 45 42 L41 42 Q41.5 35 43 28 Z" fill={fill('triceps_back_r')} />
      {/* Forearm back R */}
      <Rect x="39" y="43" width="6" height="14" rx="2" fill={base} />
      {/* Glutes */}
      <Path id="glute_l" d="M13 65 Q10 68 11 76 L22 76 Q22 68 21 65 Z" fill={fill('glute_l')} />
      <Path id="glute_r" d="M37 65 Q40 68 39 76 L28 76 Q28 68 29 65 Z" fill={fill('glute_r')} />
      {/* Hamstring L */}
      <Path id="hamstring_l" d="M12 76 Q11 84 12 92 L22 92 Q23 84 22 76 Z" fill={fill('hamstring_l')} />
      {/* Hamstring R */}
      <Path id="hamstring_r" d="M38 76 Q39 84 38 92 L28 92 Q27 84 28 76 Z" fill={fill('hamstring_r')} />
      {/* Knee back L */}
      <Ellipse cx="17" cy="93" rx="5" ry="3" fill={base} />
      {/* Knee back R */}
      <Ellipse cx="33" cy="93" rx="5" ry="3" fill={base} />
      {/* Calf back L */}
      <Path id="calf_back_l" d="M13 95 Q12 101 14 107 L20 107 Q22 101 21 95 Z" fill={fill('calf_back_l')} />
      {/* Calf back R */}
      <Path id="calf_back_r" d="M37 95 Q38 101 36 107 L30 107 Q28 101 29 95 Z" fill={fill('calf_back_r')} />
    </Svg>
  );
}

export function BodyDiagram({ primary, secondary, size = 140 }: Props) {
  const { colors } = useTheme();
  const highlight = colors.warning;
  const secondaryColor = colors.warning + '66';
  const base = colors.border;

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ width: size * 0.45, height: size }}>
        <FrontBody primary={primary} secondary={secondary} highlight={highlight} base={base} secondaryColor={secondaryColor} />
      </View>
      <View style={{ width: size * 0.45, height: size }}>
        <BackBody primary={primary} secondary={secondary} highlight={highlight} base={base} secondaryColor={secondaryColor} />
      </View>
    </View>
  );
}
