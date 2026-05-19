export interface FormCue {
  cues: string[];
  tips?: string;
}

export const FORM_CUES: Record<string, FormCue> = {
  // ── CHEST ─────────────────────────────────────────────────────────────────
  'Barbell Bench Press': {
    cues: ['Lie flat, feet planted, slight natural arch', 'Grip just outside shoulder width', 'Lower bar to lower chest under control', 'Drive bar up and slightly back toward rack'],
    tips: 'Squeeze the bar like you\'re trying to bend it — activates lats for stability.',
  },
  'Incline Barbell Bench Press': {
    cues: ['Set bench to 30–45°', 'Bar path angles more toward upper chest', 'Elbows at ~60° to torso, not flared wide', 'Control the descent; don\'t bounce off chest'],
  },
  'Dumbbell Bench Press': {
    cues: ['Start with DBs on thighs, kick up one at a time', 'Neutral or pronated grip, elbows ~75° to torso', 'Press up and slightly in at the top', 'Full stretch at bottom, full squeeze at top'],
  },
  'Dumbbell Flye': {
    cues: ['Slight bend in elbows throughout', 'Arc the weights out and down like hugging a barrel', 'Stretch pecs at the bottom without forcing range', 'Squeeze chest to bring DBs back together'],
    tips: 'This is a stretch movement — keep weights lighter than press.',
  },
  'Cable Crossover': {
    cues: ['Set cables to shoulder height or higher', 'Step forward into a staggered stance', 'Arms slightly bent, sweep down and across midline', 'Squeeze pecs hard at the finish — don\'t just let hands touch'],
  },
  'Push-Up': {
    cues: ['Hands just outside shoulders, fingers forward', 'Body in a straight line from head to heels', 'Lower chest to just above floor', 'Press up, keep core tight throughout'],
    tips: 'Think "pushing the floor away" rather than pushing yourself up.',
  },
  'Dips': {
    cues: ['Lean forward slightly to hit chest', 'Elbows flare out slightly (chest focus)', 'Lower until upper arms are roughly parallel', 'Drive back up without locking out elbows'],
  },
  'Pec Deck': {
    cues: ['Sit tall, back flat against pad', 'Elbows at 90°, forearms on pads', 'Squeeze arms together in front of chest', 'Resist on the way back — don\'t let weight slam'],
  },

  // ── BACK ──────────────────────────────────────────────────────────────────
  'Pull-Up': {
    cues: ['Hang with full arm extension', 'Initiate by depressing shoulder blades (lat activation)', 'Pull elbows down toward hips', 'Chin clears bar — controlled descent'],
    tips: 'Dead hang at the bottom each rep maximises range of motion.',
  },
  'Chin-Up': {
    cues: ['Supinated grip (palms toward you), shoulder width', 'Engage biceps and lats simultaneously', 'Pull chest toward bar', 'Full extension at the bottom between reps'],
  },
  'Barbell Row': {
    cues: ['Hip hinge, torso ~45°, knees soft', 'Bar starts below chest, grip just outside knees', 'Drive elbows back and up — bar to lower chest', 'Hold briefly at top; lower with control'],
    tips: 'Keep lower back neutral. A slight torso swing at heavy weight is OK — excessive is not.',
  },
  'Dumbbell Row': {
    cues: ['Support free hand and same knee on bench', 'Opposite foot on floor for stability', 'Pull elbow up toward hip — don\'t rotate excessively', 'Full stretch at bottom, full retraction at top'],
  },
  'Seated Cable Row': {
    cues: ['Sit tall, knees slightly bent, brace core', 'Pull handle to lower sternum, elbows close to sides', 'Squeeze shoulder blades together at end', 'Controlled forward lean on the stretch'],
  },
  'Lat Pulldown': {
    cues: ['Slight back lean, chest up', 'Wide overhand grip or shoulder-width for more lat', 'Pull bar to upper chest, elbows drive down and back', 'Full arm extension at the top'],
    tips: 'Imagine pulling your elbows into your back pockets.',
  },
  'T-Bar Row': {
    cues: ['Straddle the bar, hip hinge to ~45°', 'Arms full extension at start', 'Pull to lower chest, retract scapulae', 'Avoid rounding the lower back'],
  },
  'Face Pull': {
    cues: ['Set cable at head height, rope attachment', 'Pull toward face, hands going either side of head', 'Externally rotate — hands end up behind ears', 'Pause at peak contraction'],
    tips: 'Light weight, high reps. This is a shoulder health exercise first.',
  },
  'Deadlift': {
    cues: ['Bar over mid-foot, shoulder-width stance', 'Hinge, grip outside knees, flatten back', 'Push floor away — don\'t think "pull"', 'Hips and shoulders rise at same rate', 'Lock out glutes at the top'],
    tips: 'The setup is everything. Take an extra second to brace before every single rep.',
  },
  'Romanian Deadlift': {
    cues: ['Start standing, slight bend in knees', 'Push hips back, bar traces legs on the way down', 'Stop when hamstrings are fully stretched (mid-shin)', 'Drive hips forward to return'],
  },
  'Hyperextension': {
    cues: ['Position pad below hip crease', 'Cross arms on chest or hold plate', 'Hinge at hip, lower torso toward floor', 'Raise back until body is straight — no hyperextend'],
  },

  // ── SHOULDERS ─────────────────────────────────────────────────────────────
  'Barbell Overhead Press': {
    cues: ['Bar on front delts, grip outside shoulder width', 'Press straight up, head goes through the "window"', 'Lock out overhead, shrug into traps at top', 'Lower back to clavicles under control'],
    tips: 'Squeeze glutes and core — the press is a full-body brace, not just shoulders.',
  },
  'Dumbbell Shoulder Press': {
    cues: ['DBs at shoulder height, slight neutral or pronated grip', 'Press up and slightly in, don\'t crash at top', 'Full overhead extension without shrugging excessively', 'Controlled descent to ear level'],
  },
  'Lateral Raise': {
    cues: ['Slight forward lean, soft elbows', 'Lead with elbows, raise to shoulder height', 'Pinky slightly higher than thumb (internal rotation)', 'Lower slowly — the eccentric matters'],
    tips: 'Heavier weight often means traps take over. Keep it strict.',
  },
  'Front Raise': {
    cues: ['Arms nearly straight, palms down or neutral', 'Raise to shoulder height — not above', 'Avoid swinging the torso', 'Lower slowly under control'],
  },
  'Rear Delt Fly': {
    cues: ['Bent over at 90° or seated face-down on incline bench', 'Arms slightly bent, lead with elbows outward', 'Squeeze rear delts and retract shoulder blades', 'Avoid using momentum'],
  },
  'Arnold Press': {
    cues: ['Start with DBs at chin, palms facing you', 'Rotate and press — palms face forward at top', 'Reverse the rotation on the way down', 'Full range of motion — this hits all three delt heads'],
  },
  'Upright Row': {
    cues: ['Narrow grip (shoulder or narrower)', 'Lead with elbows, pull bar to chin height', 'Elbows should be above wrists throughout', 'Lower in a controlled arc'],
    tips: 'Wide grip reduces impingement risk. Stop at shoulder height if you feel shoulder pinching.',
  },

  // ── ARMS ──────────────────────────────────────────────────────────────────
  'Barbell Curl': {
    cues: ['Underhand grip, shoulder width', 'Elbows pinned to sides — don\'t let them drift forward', 'Curl to shoulder level, squeeze at top', 'Full extension at the bottom'],
    tips: 'Curl the pinky side of the hand toward the shoulder for a better peak contraction.',
  },
  'Dumbbell Curl': {
    cues: ['Alternate or simultaneous, palms up', 'Supinate as you curl (rotate pinky up)', 'No body swing — strict form first', 'Lower slowly for more bicep stimulus'],
  },
  'Hammer Curl': {
    cues: ['Neutral grip (palms facing each other) throughout', 'Curl keeping neutral grip — hits brachialis', 'Elbows stay at sides', 'Squeeze at top, full extension at bottom'],
  },
  'Preacher Curl': {
    cues: ['Upper arms fully supported on pad', 'Full stretch at bottom — don\'t lock out hard', 'Curl to just short of vertical', 'Zero momentum allowed'],
  },
  'Cable Curl': {
    cues: ['Low pulley, underhand grip', 'Elbows at sides and stationary', 'Curl to shoulder height', 'Return slowly, feel the stretch at the bottom'],
  },
  'Incline Dumbbell Curl': {
    cues: ['Lie back on incline bench, arms hang straight', 'Full stretch on the bicep (long head emphasis)', 'Curl without lifting shoulders off bench', 'Excellent long-head isolator'],
  },
  'Tricep Pushdown': {
    cues: ['High cable, bar or rope attachment', 'Elbows pinned to sides', 'Drive handles down to full extension', 'Squeeze triceps at lockout; controlled return'],
  },
  'Skull Crusher': {
    cues: ['Lie flat, arms extended over chest', 'Hinge only at the elbow — upper arms stay vertical', 'Lower bar toward forehead or just above', 'Extend back up to full lockout'],
    tips: 'A slight backward angle of the upper arms at bottom increases long head stretch.',
  },
  'Overhead Tricep Extension': {
    cues: ['Arms overhead, elbows close to ears', 'Lower weight behind head by bending elbows only', 'Full stretch on the long head', 'Drive back up to full extension'],
  },
  'Close Grip Bench Press': {
    cues: ['Grip about shoulder width or slightly inside', 'Keep elbows closer to torso than a normal bench', 'Lower to lower chest', 'Press and squeeze triceps at lockout'],
  },
  'Tricep Dip': {
    cues: ['Upright torso, elbows tracking backward (not flared)', 'Lower until elbows at ~90°', 'Press back up, squeeze triceps at lockout', 'Keep legs extended or cross feet for bodyweight version'],
  },
  'Diamond Push-Up': {
    cues: ['Hands form a diamond shape directly below chest', 'Elbows track back along the body', 'Lower chest toward hands', 'Press up and squeeze triceps at top'],
  },

  // ── LEGS ──────────────────────────────────────────────────────────────────
  'Barbell Back Squat': {
    cues: ['Bar on traps (high bar) or rear delts (low bar)', 'Feet shoulder-width, toes slightly out', 'Brace core, chest up, break at hips and knees together', 'Depth: at minimum crease of hip below knee', 'Drive knees out over toes on the way up'],
    tips: 'Think "knees out, chest up" as your two cues every single rep.',
  },
  'Front Squat': {
    cues: ['Bar rests on front delts, elbows high', 'Upright torso throughout', 'Knees track toes — more quad-dominant', 'Core must stay braced — bar will fall if you fold'],
  },
  'Leg Press': {
    cues: ['Foot placement determines muscle emphasis', 'High wide feet = more glutes/hamstrings', 'Low narrow feet = more quads', 'Don\'t lock out knees fully at top', 'Lower only to comfortable depth — no tail bone lifting'],
  },
  'Hack Squat': {
    cues: ['Feet low on platform, shoulder width', 'Brace and lower to 90° minimum', 'Keep chest up against pad', 'Drive through heels back to start'],
  },
  'Leg Extension': {
    cues: ['Pad should sit just above ankle', 'Extend to full lockout — squeeze at top', 'Lower slowly for quad time under tension', 'Avoid swinging the torso back'],
  },
  'Leg Curl': {
    cues: ['Lying: pad at ankle, hips flat to bench', 'Curl heels toward glutes', 'Pause at peak — don\'t let hips lift', 'Lower slowly for hamstring loading'],
  },
  'Bulgarian Split Squat': {
    cues: ['Rear foot elevated on bench', 'Front foot far enough forward so shin stays vertical', 'Lower knee toward floor, knee tracks toes', 'Drive up through front heel'],
    tips: 'This is brutally hard. Start with bodyweight before loading.',
  },
  'Lunge': {
    cues: ['Step forward, lower back knee toward floor', 'Front shin stays vertical — foot far enough forward', 'Push back to start through front heel', 'Stay upright, avoid leaning forward'],
  },
  'Goblet Squat': {
    cues: ['Hold dumbbell or kettlebell at chest', 'Feet slightly wider than shoulder width', 'Elbows inside knees at the bottom', 'Upright torso, chest up, deep squat'],
  },
  'Calf Raise': {
    cues: ['Balls of feet on edge of platform', 'Full range: deep stretch at bottom, max squeeze at top', 'Slow and controlled beats bouncing', 'Straight knee = gastrocnemius focus'],
    tips: 'Bent knee calf raises (seated) target soleus more.',
  },
  'Seated Calf Raise': {
    cues: ['Pad sits just above knees', 'Balls of feet on platform, knees at 90°', 'Full range of motion — deep drop and max squeeze', 'Slow tempo is key for the soleus'],
  },

  // ── GLUTES ────────────────────────────────────────────────────────────────
  'Hip Thrust': {
    cues: ['Upper back on bench, bar over hip crease (pad it)', 'Feet flat, hip-width', 'Drive hips up until body is parallel to floor', 'Squeeze glutes hard at top — tuck pelvis', 'Chin tucked — don\'t hyperextend neck looking up'],
    tips: 'Full glute squeeze at the top + posterior pelvic tilt = maximum activation.',
  },
  'Glute Bridge': {
    cues: ['Lie flat, feet hip-width near glutes', 'Drive hips up through heels', 'Squeeze glutes at the top', 'Lower without touching floor between reps'],
  },
  'Cable Kickback': {
    cues: ['Ankle attachment, face cable machine', 'Hinge slightly forward, brace on machine', 'Drive leg back and up, squeeze glute at peak', 'Control the return'],
  },
  'Sumo Deadlift': {
    cues: ['Wide stance, toes pointed well out', 'Grip inside the legs, arms vertical', 'Push knees out over toes as you pull', 'Lead hips forward at lockout'],
  },

  // ── CORE ──────────────────────────────────────────────────────────────────
  'Plank': {
    cues: ['Forearms or straight arms, body flat', 'Squeeze glutes and abs simultaneously', 'Don\'t let hips sag or pike up', 'Breathe steadily — don\'t hold breath'],
  },
  'Crunch': {
    cues: ['Feet flat, lower back on floor', 'Curl shoulders toward knees — only upper back lifts', 'Exhale at top, squeeze abs', 'Don\'t pull on neck with hands'],
  },
  'Sit-Up': {
    cues: ['Feet anchored, hands crossed or at temples', 'Curl all the way up, torso to thighs', 'Lower with control — eccentric matters', 'Don\'t use momentum from the hips'],
  },
  'Leg Raise': {
    cues: ['Lie flat, lower back pressed into floor', 'Raise legs to 90°, lower slowly', 'Stop before lower back lifts off floor', 'For harder version: lower legs toward floor without touching'],
  },
  'Cable Crunch': {
    cues: ['Kneel, rope at back of head', 'Curl spine down — hips stay put', 'It\'s a crunch, not a hip flexion — feel abs working', 'Slow controlled return'],
  },
  'Russian Twist': {
    cues: ['Sit at 45°, feet off floor (harder) or down (easier)', 'Rotate torso side to side', 'Move from the obliques, not just the arms', 'Keep chest tall — don\'t round forward'],
  },
  'Ab Wheel Rollout': {
    cues: ['Kneel, hands on wheel below shoulders', 'Roll forward, keep arms straight, brace hard', 'Stop before lower back collapses', 'Pull wheel back using abs — not hip flexors'],
    tips: 'One of the hardest core exercises. Master partial reps before going full extension.',
  },
  'Hanging Knee Raise': {
    cues: ['Dead hang to start', 'Brace core, then bring knees to chest', 'Don\'t swing — control the movement', 'Lower slowly for more tension'],
  },

  // ── CARDIO ────────────────────────────────────────────────────────────────
  'Treadmill Run': {
    cues: ['Slight forward lean from the ankles (not waist)', 'Land mid-foot under your center of mass', 'Arms bent at 90°, driving forward (not across chest)', 'Steady breathing rhythm: 3 steps in, 2 out'],
  },
  'Rowing Machine': {
    cues: ['Catch: shins vertical, arms extended, body slightly forward', 'Drive through legs first, then lean back, then pull arms', 'Finish: handle at lower chest, slight back lean', 'Return arms first, then body, then slide'],
    tips: 'Legs are 60% of the power. Drive the feet — don\'t pull with arms first.',
  },
  'Assault Bike': {
    cues: ['Push and pull the handles simultaneously with legs', 'Stay seated for sustained work; stand for sprints', 'Consistent cadence beats frantic speed', 'Breathe — it\'s easy to forget with this one'],
  },
  'Jump Rope': {
    cues: ['Stay on balls of feet — don\'t flat-foot', 'Wrists do the turning, not shoulders', 'Keep elbows close to sides', 'Small controlled jumps, not big bounds'],
  },

  // ── TRAPS ─────────────────────────────────────────────────────────────────
  'Barbell Shrug': {
    cues: ['Hold bar in front or behind, shoulder width grip', 'Shrug straight up — don\'t roll shoulders', 'Hold the contraction for 1 second at top', 'Lower fully for a complete stretch'],
    tips: 'Rolling the shoulders can stress the AC joint. Straight up and down only.',
  },
  'Dumbbell Shrug': {
    cues: ['DBs at sides, arms straight', 'Shrug shoulders straight up toward ears', 'Hold at top, lower slowly', 'Full depression at the bottom for range'],
  },

  // ── COMPOUND / POWERLIFTS ─────────────────────────────────────────────────
  'Power Clean': {
    cues: ['Start like a deadlift — bar over mid-foot', 'First pull: hips and shoulders rise together', 'Second pull: explosive hip extension, shrug, pull elbows high', 'Catch bar on front delts in a partial squat', 'Stand to finish'],
    tips: 'The hip explosion (second pull) is everything. It\'s not a bicep curl from the floor.',
  },
  'Kettlebell Swing': {
    cues: ['Hinge at hip — this is NOT a squat', 'Hike KB back between legs', 'Explosive hip snap drives KB forward', 'Arms are just a pendulum — hips power the swing', 'Hard brace at the top'],
  },
  'Farmer\'s Walk': {
    cues: ['Heavy DBs or KBs at sides', 'Stand tall, shoulders back and down', 'Small controlled steps — don\'t waddle', 'Breathe steadily, grip tight'],
  },
};
