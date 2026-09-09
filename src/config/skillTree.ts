export type SkillLevelNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type SkillNodeKind = 'movement' | 'mobility';

export interface SkillLevel {
  level: SkillLevelNumber;
  title: string;
  theme: string;
}

export interface SkillNode {
  /** `L{level}-N{n}` for movement nodes in spec order; `L{level}-M1` for the level's standalone mobility node. */
  id: string;
  level: SkillLevelNumber;
  title: string;
  kind: SkillNodeKind;
  skills: string[];
  /** Ids of nodes the spec names as prerequisites. Advisory only — never blocks. */
  prereqs: string[];
  /** Free-text prerequisites the spec does not tie to a node. */
  prereqNotes: string[];
  benchmark: string;
}

/** Source: Second Brain › Bellskill Product › bellskill_full_skill_tree_spec_v2.md */
export const SKILL_LEVELS: readonly SkillLevel[] = [
  { level: 1, title: 'Foundation', theme: 'Build body awareness and joint prep to move safely under any load.' },
  { level: 2, title: 'First load', theme: 'Pick up the bell for the first time with a safe, powerful pattern.' },
  { level: 3, title: 'Unilateral intro', theme: 'One bell, one side. Expose and address asymmetries.' },
  { level: 4, title: 'Press & pull', theme: 'Build the overhead and pulling patterns that unlock all upper body work.' },
  { level: 5, title: 'Ground work', theme: 'Get on and off the floor safely under load. The foundation of the Turkish getup.' },
  { level: 6, title: 'Full Turkish getup & bilateral hinge', theme: 'Master the king of kettlebell movements, and pick up two bells in the hike position.' },
  { level: 7, title: 'Double kettlebell entry', theme: 'Two bells. Twice the demand on everything.' },
  { level: 8, title: 'Power & strength', theme: 'Express everything you have built. High load, high power.' },
  { level: 9, title: 'Elite', theme: 'The full expression. Double power movements at the highest demand.' },
];

const node = (
  id: string,
  level: SkillLevelNumber,
  title: string,
  kind: SkillNodeKind,
  skills: string[],
  prereqs: string[],
  prereqNotes: string[],
  benchmark: string,
): SkillNode => ({ id, level, title, kind, skills, prereqs, prereqNotes, benchmark });

export const SKILL_NODES: readonly SkillNode[] = [
  // Level 1 — Foundation
  node('L1-N1', 1, 'Breathing & bracing', 'movement',
    ['Diaphragmatic breathing', '360° rib expansion', 'Bracing on exhale'],
    [], [],
    'Full brace on demand; holds brace through a 10-second plank without breath-holding.'),
  node('L1-N2', 1, 'Hip hinge pattern', 'movement',
    ['Hinge vs squat distinction', 'Neutral spine awareness', 'Posterior loading'],
    [], ['Basic hamstring length (touch mid-shin with soft knees)', 'No acute lower back pain'],
    'Clean hinge to parallel with neutral spine, 10 reps bodyweight, no cues needed.'),
  node('L1-N3', 1, 'Goblet squat', 'movement',
    ['Vertical torso squat', 'Knee tracking', 'Heel-grounded depth'],
    [], ['Ankle dorsiflexion (squat to parallel without heels rising)', 'Basic hip flexor length'],
    'Full depth goblet squat, heels down, chest up, 5 reps at 12kg.'),
  node('L1-N4', 1, 'Deadbug', 'movement',
    ['Lumbar spine imprint', 'Contralateral limb extension', 'Breath coordination'],
    ['L1-N1'], [],
    '5 slow reps per side, zero lumbar lift-off, coordinated with exhale.'),
  node('L1-N5', 1, 'Grip & wrist prep', 'movement',
    ['Crush grip vs hook grip', 'Wrist extension mobility', 'Forearm flexibility'],
    [], [],
    'Carry 16kg for 30 seconds per hand without grip failure; full wrist extension without pain.'),
  node('L1-N6', 1, 'Single leg balance', 'movement',
    ['Hip abductor engagement', 'Ankle stability', 'Gaze fixation'],
    ['L1-N3'], ['Basic ankle awareness'],
    '30 seconds per leg, eyes closed, no significant sway.'),

  // Level 2 — First load
  node('L2-M1', 2, 'Hip flexor & ankle prep', 'mobility',
    ['90/90 hip flexor stretch', 'Couch stretch', 'Ankle dorsiflexion work'],
    [], [],
    'Full depth bodyweight squat with heels flat, hip flexors relaxed at full extension.'),
  node('L2-N1', 2, 'Kettlebell deadlift', 'movement',
    ['Handle grip', 'Lat engagement ("protect your armpits")', 'Bracing under load'],
    [], ['Neutral spine under load', 'Hamstring length'],
    '10 clean reps at 30% BW, no rounding, full hip extension at top.'),
  node('L2-N2', 2, 'Two-hand swing', 'movement',
    ['Hip drive initiation', 'Float at top', 'Safe backswing', 'Breathing rhythm'],
    ['L1-N2'], [],
    '20 consecutive reps at 30% BW, consistent form start to finish.'),
  node('L2-N3', 2, "Farmer's carry", 'movement',
    ['Tall spine under load', 'Packed shoulders', 'Gait control'],
    ['L1-N5'], [],
    '40 meters per hand at 25% BW without grip failure or lateral lean.'),

  // Level 3 — Unilateral intro
  node('L3-M1', 3, 'Thoracic rotation & shoulder prep', 'mobility',
    ['Open books', 'Thoracic rotation on foam roller', 'Shoulder CARs (controlled articular rotations)'],
    [], [],
    '45° thoracic rotation per side; shoulder circles with no clicking or pain.'),
  node('L3-N1', 3, 'Single-hand swing', 'movement',
    ['Anti-rotation bracing', 'Hip drive with single arm', 'Handle transition'],
    ['L2-N2'], [],
    '15 reps per side at 25% BW, no trunk rotation, clean float at top.'),
  node('L3-N2', 3, 'Suitcase carry', 'movement',
    ['Resist side-bending', 'Shoulder packed down', 'Level hips'],
    ['L2-N3'], [],
    '40 meters per hand at 20% BW, no visible hip hike or trunk tilt.'),

  // Level 4 — Press & pull
  node('L4-M1', 4, 'Wrist & elbow joint prep', 'mobility',
    ['Wrist extension mobility', 'Pronation/supination', 'Rack position stretch'],
    [], [],
    'Full rack position held 30 seconds per side without wrist or elbow pain.'),
  node('L4-N1', 4, 'Clean', 'movement',
    ['Tight arc close to body', 'Elbow drives back not out', 'Soft catch in rack'],
    ['L3-N1', 'L4-M1'], [],
    '10 reps per side at 25% BW, no forearm bruising, quiet catch.'),
  node('L4-N2', 4, 'Half-kneeling press', 'movement',
    ['Glute squeeze on down knee', 'Vertical forearm in rack', 'Full lock-out overhead'],
    ['L3-M1'], ['Shoulder CARs'],
    '5 reps per side at 20% BW, no lateral lean, full overhead lock-out.'),
  node('L4-N3', 4, 'Strict overhead press', 'movement',
    ['Lat engagement at bottom', 'Vertical forearm at start', 'Full lock-out with bicep by ear'],
    ['L4-N2', 'L3-M1'], [],
    '5 reps per side at 25% BW, strict, full ROM, no lateral lean.'),
  node('L4-N4', 4, 'Rack hold & front rack walk', 'movement',
    ['Vertical forearm', 'Elbow down', 'Core braced', 'Relaxed grip in rack'],
    ['L4-N1'], [],
    '60 second rack hold per side at 25% BW, then 20 meters walking in rack.'),

  // Level 5 — Ground work
  node('L5-M1', 5, 'Deep hip & thoracic opener', 'mobility',
    ['Pigeon pose', 'Thoracic extension over foam roller', 'Shoulder packed in overhead position'],
    [], [],
    'Comfortable deep hip external rotation (shin parallel in 90/90); 10 second shoulder stability in overhead hold.'),
  node('L5-N1', 5, 'Segmented Turkish getup (unloaded)', 'movement',
    ['Roll to elbow', 'Push to hand', 'High bridge', 'Sweep to half-kneeling', 'Stand — and reverse'],
    ['L5-M1', 'L1-N6'], [],
    'All 7 positions clean with a shoe balanced on the fist, both sides.'),
  node('L5-N2', 5, 'Deep squat mobility', 'movement',
    ['Hip flexion at end range', 'Ankle dorsiflexion at depth', 'Thoracic upright under load'],
    ['L1-N3', 'L2-M1'], [],
    '5 reps full depth paused goblet squat at 25% BW, 2-second pause at bottom.'),
  node('L5-N3', 5, 'Windmill (light)', 'movement',
    ['Rotate and hinge to side', 'Press arm stays vertical', 'Gaze on bell overhead'],
    ['L4-N3', 'L3-M1'], [],
    '5 reps per side at 15% BW overhead, controlled tempo, no balance breaks.'),
  node('L5-N4', 5, 'Push press', 'movement',
    ['Dip and drive timing', 'Vertical torso in dip', 'Full lock-out at top'],
    ['L4-N3'], [],
    '5 reps per side at 30% BW, clean timing, full overhead extension.'),

  // Level 6 — Full Turkish getup & bilateral hinge
  node('L6-M1', 6, 'Shoulder stability & overhead endurance', 'mobility',
    ['Bottoms-up kettlebell hold', 'One-arm overhead carries', 'Waiter walks'],
    [], [],
    '30 second bottoms-up hold per side at 15% BW; 20 meter waiter walk per side at 20% BW.'),
  node('L6-N1', 6, 'Turkish getup with load', 'movement',
    ['All 7 positions under load', 'Gaze discipline', 'Controlled tempo throughout'],
    ['L5-N1', 'L6-M1'], [],
    '3 smooth reps per side at 25% BW, no position breaks, controlled throughout.'),
  node('L6-N2', 6, 'Windmill with load', 'movement',
    ['Hip shift', 'Lateral hinge', 'Maintaining overhead lock-out through full ROM'],
    ['L5-N3', 'L6-N1'], [],
    '5 reps per side at 20% BW overhead, controlled, no knee bend.'),
  node('L6-N3', 6, 'Double swing', 'movement',
    ['Synchronized hip drive', 'Double handle grip', 'Managing increased momentum'],
    ['L3-N1'], [],
    '15 reps at 20% BW per bell, synchronized float, consistent form.'),

  // Level 7 — Double kettlebell entry
  node('L7-M1', 7, 'Front rack bilateral position', 'mobility',
    ['Double rack hold', 'Breathing in the rack', 'Walking in double rack'],
    [], [],
    '90 second double rack hold at 15% BW per bell; 20 meter walk in double rack.'),
  node('L7-N1', 7, 'Double clean', 'movement',
    ['Synchronized arc', 'Simultaneous soft catch', 'Managing rack compression'],
    ['L4-N1', 'L6-N3', 'L7-M1'], [],
    '10 reps at 20% BW per bell, quiet catch, both bells in rack simultaneously.'),
  node('L7-N2', 7, 'Double front squat', 'movement',
    ['Vertical torso under bilateral load', 'Knee tracking', 'Full depth with rack maintained'],
    ['L7-N1', 'L5-N2'], [],
    '5 reps at 20% BW per bell, full depth, rack maintained throughout.'),
  node('L7-N3', 7, 'Double overhead press', 'movement',
    ['Synchronized press', 'Lat engagement bilateral', 'Full double lockout'],
    ['L7-N1', 'L5-N4'], [],
    '5 strict reps at 20% BW per bell, full bilateral lock-out.'),

  // Level 8 — Power & strength
  node('L8-M1', 8, 'Hip flexor & thoracic loading prep', 'mobility',
    ['Reassess hip flexor length', 'Thoracic rotation under fatigue', 'Shoulder overhead position under fatigue'],
    ['L2-M1', 'L3-M1'], [],
    'Pass all Level 2 and 3 mobility benchmarks — full reassessment.'),
  node('L8-N1', 8, 'Snatch (single)', 'movement',
    ['High pull to elbow', 'Punch through at top', 'Soft overhead catch', 'Hinge-driven backswing'],
    ['L3-N1', 'L5-N4', 'L6-M1'], [],
    '10 reps per side at 25% BW, safe catch, no wrist flip, full lock-out.'),
  node('L8-N2', 8, 'Long cycle clean & press', 'movement',
    ['Clean-to-press timing', 'Rack recovery between reps', 'Breathing strategy under load'],
    ['L7-N1', 'L7-N3'], [],
    '5 reps per side at 25% BW, clean into strict press, controlled throughout.'),
  node('L8-N3', 8, 'Long cycle clean & jerk (double)', 'movement',
    ['Dip timing under bilateral load', 'Jerk vs press distinction', 'Rack recovery'],
    ['L8-N2', 'L7-N3'], [],
    '5 reps at 20% BW per bell, clean jerk timing, full double overhead.'),

  // Level 9 — Elite
  node('L9-M1', 9, 'Full system reassessment', 'mobility',
    ['Full overhead assessment', 'Hip rotation audit', 'Ankle and thoracic recheck'],
    ['L2-M1', 'L3-M1', 'L6-M1'], [],
    'Pass all mobility benchmarks from Levels 2, 3, and 6.'),
  node('L9-N1', 9, 'Double snatch', 'movement',
    ['Synchronized arc', 'Bilateral punch-through', 'Managing double overhead landing'],
    ['L8-N1', 'L6-N3'], [],
    '5 reps at 20% BW per bell, synchronized, both bells locked out simultaneously.'),
];

export const SKILL_NODE_BY_ID: ReadonlyMap<string, SkillNode> = new Map(
  SKILL_NODES.map((skillNode) => [skillNode.id, skillNode]),
);
