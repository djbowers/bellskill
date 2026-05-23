#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const CSV_TO_DB_COLUMN = [
  null,
  'Movement',
  'Short YouTube Demonstration',
  'In-Depth YouTube Explanation',
  'Difficulty Level',
  'Target Muscle Group',
  'Prime Mover Muscle',
  'Secondary Muscle',
  'Tertiary Muscle',
  'Primary Equipment',
  '# Primary Items',
  'Secondary Equipment',
  '# Secondary Items',
  'Posture',
  'Single or Double Arm',
  'Continuous or Alternating Arms',
  'Grip',
  'Load Position (Ending)',
  'Continuous or Alternating Legs',
  'Foot Elevation',
  'Combination Exercises',
  'Movement Pattern #1',
  'Movement Pattern #2',
  'Movement Pattern #3',
  'Plane Of Motion #1',
  'Plane Of Motion #2',
  'Plane Of Motion #3',
  'Body Region',
  'Force Type',
  'Mechanics',
  'Laterality',
  'Primary Exercise Classification',
];

const ENUM_COLUMNS = new Set([
  'Difficulty Level',
  'Target Muscle Group',
  'Prime Mover Muscle',
  'Secondary Muscle',
  'Tertiary Muscle',
  'Primary Equipment',
  'Secondary Equipment',
  'Posture',
  'Single or Double Arm',
  'Continuous or Alternating Arms',
  'Grip',
  'Load Position (Ending)',
  'Continuous or Alternating Legs',
  'Foot Elevation',
  'Combination Exercises',
  'Movement Pattern #1',
  'Movement Pattern #2',
  'Movement Pattern #3',
  'Plane Of Motion #1',
  'Plane Of Motion #2',
  'Plane Of Motion #3',
  'Body Region',
  'Force Type',
  'Mechanics',
  'Laterality',
  'Primary Exercise Classification',
]);

const NUMERIC_COLUMNS = new Set(['# Primary Items', '# Secondary Items']);

const ENUM_VALUES = {
  'Body Region': [
    'Full Body',
    'Lower Body',
    'Midsection',
    'Unsorted*',
    'Upper Body',
  ],
  'Combination Exercises': ['Single Exercise', 'Combo Exercise'],
  'Continuous or Alternating Arms': ['Alternating', 'Continuous'],
  'Continuous or Alternating Legs': ['Alternating', 'Continuous'],
  'Difficulty Level': [
    'Beginner',
    'Intermediate',
    'Novice',
    'Advanced',
    'Expert',
    'Grand Master',
    'Master',
    'Legendary',
  ],
  'Foot Elevation': [
    'Feet Elevated',
    'Foot Elevated',
    'Foot Elevated (Front)',
    'Foot Elevated (Lateral)',
    'Foot Elevated (Rear)',
    'Foot Elevated (Side)',
    'Heels Elevated',
    'No Elevation',
    'Toes Elevated',
  ],
  'Force Type': ['Other', 'Pull', 'Push', 'Push & Pull', 'Unsorted*'],
  Grip: [
    'Bottoms Up',
    'Bottoms Up Horn Grip',
    'Crush Grip',
    'False Grip',
    'Fingertip',
    'Flat Palm',
    'Forearm',
    'Goblet',
    'Hand Assisted',
    'Head Supported',
    'Horn Grip',
    'Mixed Grip',
    'Neutral',
    'No Grip',
    'Other',
    'Pronated',
    'Supinated',
    'Waiter Hold',
  ],
  Laterality: ['Contralateral', 'Bilateral', 'Unilateral', 'Ipsilateral'],
  'Load Position (Ending)': [
    'Above Chest',
    'Back Rack',
    'Bear Hug',
    'Behind Back',
    'Front Rack',
    'Hip Crease',
    'Lateral',
    'Low Hold',
    'No Load',
    'Order',
    'Other',
    'Overhead',
    'Shoulder',
    'Suitcase',
    'Zercher',
  ],
  Mechanics: ['Compound', 'Isolation', 'Pull'],
  'Movement Pattern #1': null,
  'Movement Pattern #2': null,
  'Movement Pattern #3': null,
  'Plane Of Motion #1': ['Frontal Plane', 'Sagittal Plane', 'Transverse Plane'],
  'Plane Of Motion #2': ['Frontal Plane', 'Sagittal Plane', 'Transverse Plane'],
  'Plane Of Motion #3': ['Frontal Plane', 'Sagittal Plane', 'Transverse Plane'],
  Posture: [
    '90/90 Seated',
    'Bridge',
    'Half Kneeling',
    'Hanging',
    'Horse Stance',
    'Inverted',
    'Knee Hover Quadruped',
    'Knee Over Toe Split Squat',
    'Knee Supported',
    'Kneeling',
    'L Sit',
    'March',
    'Other',
    'Prone',
    'Quadruped',
    'Seated',
    'Seated Floor',
    'Shin Box Seated',
    'Side Lying',
    'Side Plank',
    'Single Leg Bridge',
    'Single Leg Standing',
    'Single Leg Standing Bent Knee',
    'Single Leg Supported',
    'Split Squat',
    'Split Squat Isometric',
    'Staggered Stance',
    'Standing',
    'Supine',
    'Tall Kneeling',
    'Toe Balance',
    'Tuck L Sit',
    'V Sit Seated',
    'Walking',
    'Wall Sit',
    'Isometric Split Squat',
    'Running',
  ],
  'Primary Equipment': null,
  'Primary Exercise Classification': [
    'Animal Flow',
    'Balance',
    'Ballistics',
    'Bodybuilding',
    'Calisthenics',
    'Grinds',
    'Mobility',
    'Olympic Weightlifting',
    'Plyometric',
    'Postural',
    'Powerlifting',
    'Unsorted*',
  ],
  'Prime Mover Muscle': null,
  'Secondary Equipment': null,
  'Secondary Muscle': null,
  'Single or Double Arm': ['Single Arm', 'No Arms', 'Double Arm'],
  'Target Muscle Group': [
    'Abdominals',
    'Glutes',
    'Chest',
    'Shoulders',
    'Back',
    'Adductors',
    'Biceps',
    'Quadriceps',
    'Hamstrings',
    'Abductors',
    'Trapezius',
    'Triceps',
    'Forearms',
    'Calves',
    'Shins',
    'Hip Flexors',
  ],
  'Tertiary Muscle': null,
};

const MOVEMENT_PATTERN_VALUES = [
  'Ankle Dorsiflexion',
  'Ankle Plantar Flexion',
  'Anti-Extension',
  'Anti-Flexion',
  'Anti-Lateral Flexion',
  'Anti-Rotational',
  'Elbow Extension',
  'Elbow Flexion',
  'Hip Abduction',
  'Hip Adduction',
  'Hip Dominant',
  'Hip Extension',
  'Hip External Rotation',
  'Hip Flexion',
  'Hip Hinge',
  'Horizontal Pull',
  'Horizontal Push',
  'Isometric Hold',
  'Knee Dominant',
  'Lateral Flexion',
  'Loaded Carry',
  'Rotational',
  'Scapular Elevation',
  'Shoulder Abduction',
  'Shoulder External Rotation',
  'Shoulder Flexion',
  'Shoulder Internal Rotation',
  'Shoulder Scapular Plane Elevation',
  'Spinal Extension',
  'Spinal Flexion',
  'Unsorted*',
  'Vertical Pull',
  'Vertical Push',
  'Wrist Extension',
  'Wrist Flexion',
  'Spinal Rotational',
  'Hip Internal Rotation',
  'Other',
  'Locomotion',
  'Horizontal Adduction',
  'Lateral Locomotion',
];

const EQUIPMENT_VALUES = [
  'Ab Wheel',
  'Barbell',
  'Battle Ropes',
  'Bodyweight',
  'Bulgarian Bag',
  'Cable',
  'Clubbell',
  'Dumbbell',
  'EZ Bar',
  'Gymnastic Rings',
  'Heavy Sandbag',
  'Indian Club',
  'Kettlebell',
  'Landmine',
  'Macebell',
  'Medicine Ball',
  'Miniband',
  'Parallette Bars',
  'Pull Up Bar',
  'Resistance Band',
  'Sandbag',
  'Slam Ball',
  'Sled',
  'Sliders',
  'Stability Ball',
  'Superband',
  'Suspension Trainer',
  'Tire',
  'Trap Bar',
  'Wall Ball',
  'Weight Plate',
  'None',
  'Bench (Flat)',
  'Bench (Incline)',
  'Bench (Decline)',
  'Plyo Box',
  'Slant Board',
  'Sledge Hammer',
  'Gravity Boots',
  'Climbing Rope',
];

const MUSCLE_VALUES = [
  'Rectus Abdominis',
  'Gluteus Maximus',
  'Obliques',
  'Pectoralis Major',
  'Posterior Deltoids',
  'Latissimus Dorsi',
  'Adductor Magnus',
  'Biceps Brachii',
  'Quadriceps Femoris',
  'Anterior Deltoids',
  'Biceps Femoris',
  'Gluteus Medius',
  'Upper Trapezius',
  'Triceps Brachii',
  'Brachioradialis',
  'Erector Spinae',
  'Infraspinatus',
  'Lateral Deltoids',
  'Gastrocnemius',
  'Tibialis Anterior',
  'Iliopsoas',
  'Subscapularis',
  'Soleus',
  'Vastus Mediais',
  'Rectus Femoris',
  'Serratus Anterior',
  'Teres Minor',
  'Gluteus Minimus',
  'Tensor Fasciae Latae',
  'Levator Scapulae',
  'Rhomboids',
  'Brachialis',
  'Anconeus',
  'Flexor Carpi Radialis',
  'Medial Deltoids',
  'Supraspinatus',
  'Extensor Digitorum Longus',
  'Extensor Hallucis Longus',
  'Trapezius',
  'Teres Major',
  'Tibialis Posterior',
  'Transverse Abdominis',
];

ENUM_VALUES['Movement Pattern #1'] = MOVEMENT_PATTERN_VALUES;
ENUM_VALUES['Movement Pattern #2'] = MOVEMENT_PATTERN_VALUES;
ENUM_VALUES['Movement Pattern #3'] = MOVEMENT_PATTERN_VALUES;
ENUM_VALUES['Primary Equipment'] = EQUIPMENT_VALUES;
ENUM_VALUES['Secondary Equipment'] = EQUIPMENT_VALUES;
ENUM_VALUES['Prime Mover Muscle'] = MUSCLE_VALUES;
ENUM_VALUES['Secondary Muscle'] = MUSCLE_VALUES;
ENUM_VALUES['Tertiary Muscle'] = MUSCLE_VALUES;

const VALUE_ALIASES = {
  'Body Region': {
    Core: 'Midsection',
  },
};

function parseArgs(argv) {
  const options = {
    file: null,
    dryRun: false,
    truncate: false,
    sync: false,
    prune: false,
    batchSize: 500,
    strict: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--truncate') {
      options.truncate = true;
    } else if (arg === '--sync') {
      options.sync = true;
    } else if (arg === '--prune') {
      options.prune = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--batch-size') {
      options.batchSize = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--file') {
      options.file = argv[i + 1];
      i += 1;
    } else if (!arg.startsWith('-') && !options.file) {
      options.file = arg;
    }
  }

  return options;
}

/** Parse RFC 4180-style CSV (quoted fields, escaped quotes, commas in values). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || (character === '\r' && nextCharacter === '\n')) {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      if (character === '\r') {
        index += 1;
      }
    } else if (character !== '\r') {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (inQuotes) {
    throw new Error('CSV file has an unclosed quoted field.');
  }

  return rows;
}

function findHeaderRowIndex(rows) {
  const index = rows.findIndex((columns) =>
    columns.some((value) => value.includes('Exercise')),
  );
  if (index === -1) {
    throw new Error('Could not find CSV header row containing "Exercise".');
  }
  return index;
}

function parseCsvRows(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const allRows = parseCsv(text);
  const headerRowIndex = findHeaderRowIndex(allRows);
  const rows = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < allRows.length; rowIndex += 1) {
    const columns = allRows[rowIndex];
    if (!columns.some((value) => value.trim())) {
      continue;
    }

    const movementName = columns[1]?.trim();
    if (!movementName) {
      continue;
    }

    if (columns.length !== CSV_TO_DB_COLUMN.length) {
      throw new Error(
        `Row ${rowIndex + 1} ("${movementName}") has ${columns.length} columns; expected ${CSV_TO_DB_COLUMN.length}.`,
      );
    }

    rows.push({ lineNumber: rowIndex + 1, columns });
  }

  return rows;
}

function normalizeEnumValue(column, rawValue, warnings) {
  if (!rawValue) {
    return null;
  }

  let value = rawValue.trim();
  const alias = VALUE_ALIASES[column]?.[value];
  if (alias) {
    value = alias;
  }

  const allowedValues = ENUM_VALUES[column];
  if (!allowedValues?.includes(value)) {
    const message = `${column}: "${value}" is not in the database enum`;
    if (warnings.skippedValues.has(message)) {
      warnings.skippedValues.set(message, warnings.skippedValues.get(message) + 1);
    } else {
      warnings.skippedValues.set(message, 1);
    }
    return null;
  }

  return value;
}

function rowToMovementRecord({ lineNumber, columns }, warnings) {
  const record = {};

  for (let index = 0; index < CSV_TO_DB_COLUMN.length; index += 1) {
    const column = CSV_TO_DB_COLUMN[index];
    if (!column) {
      continue;
    }

    const rawValue = columns[index]?.trim() ?? '';

    if (column === 'Movement') {
      record[column] = rawValue;
      continue;
    }

    if (NUMERIC_COLUMNS.has(column)) {
      if (!rawValue) {
        record[column] = null;
        continue;
      }

      const parsed = Number.parseInt(rawValue, 10);
      if (Number.isNaN(parsed)) {
        throw new Error(
          `Row ${lineNumber} ("${columns[1]}"): "${column}" must be a number, got "${rawValue}".`,
        );
      }
      record[column] = parsed;
      continue;
    }

    if (ENUM_COLUMNS.has(column)) {
      record[column] = normalizeEnumValue(column, rawValue, warnings);
      continue;
    }

    record[column] = rawValue || null;
  }

  if (!record.Movement) {
    throw new Error(`Row ${lineNumber} is missing a movement name.`);
  }

  return record;
}

function chunk(array, size) {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
}

/** @returns {{ byName: Map<string, string>, duplicateIds: string[] }} */
async function fetchExistingMovementIds(supabase) {
  const byName = new Map();
  const duplicateIds = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('movements')
      .select('id, Movement')
      .order('Movement')
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    if (!data?.length) {
      break;
    }

    for (const row of data) {
      const name = row.Movement?.trim();
      if (!name) {
        continue;
      }

      if (byName.has(name)) {
        duplicateIds.push(row.id);
        continue;
      }

      byName.set(name, row.id);
    }

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return { byName, duplicateIds };
}

async function removeDuplicateMovementIds(supabase, duplicateIds, batchSize) {
  if (duplicateIds.length === 0) {
    return 0;
  }

  console.log(
    `Removing ${duplicateIds.length} duplicate catalog row(s) with the same Movement name...`,
  );
  await unlinkUserMovementsFromMovementIds(supabase, duplicateIds);
  return deleteMovementsById(supabase, duplicateIds, batchSize);
}

function partitionRecordsForSync(records, existingByName) {
  const toInsert = [];
  const toUpdate = [];

  for (const record of records) {
    const existingId = existingByName.get(record.Movement);
    if (existingId) {
      toUpdate.push({ id: existingId, ...record });
    } else {
      toInsert.push(record);
    }
  }

  return { toInsert, toUpdate };
}

function csvMovementNames(records) {
  return new Set(records.map((record) => record.Movement));
}

/** @returns {{ id: string, name: string }[]} */
function findMovementsToPrune(existingByName, csvNames) {
  const toPrune = [];

  for (const [name, id] of existingByName) {
    if (!csvNames.has(name)) {
      toPrune.push({ id, name });
    }
  }

  toPrune.sort((left, right) => left.name.localeCompare(right.name));
  return toPrune;
}

async function unlinkUserMovementsFromMovementIds(supabase, movementIds) {
  for (const [batchIndex, batch] of chunk(movementIds, 500).entries()) {
    const { error } = await supabase
      .from('user_movements')
      .update({ functional_movement_id: null })
      .in('functional_movement_id', batch);

    if (error) {
      throw new Error(
        `Failed to clear user_movements links (batch ${batchIndex + 1}): ${error.message}`,
      );
    }
  }
}

async function deleteMovementsById(supabase, movementIds, batchSize) {
  const batches = chunk(movementIds, batchSize);
  let deleted = 0;

  for (const [batchIndex, batch] of batches.entries()) {
    const { error } = await supabase.from('movements').delete().in('id', batch);
    if (error) {
      throw new Error(
        `Prune delete failed on batch ${batchIndex + 1}/${batches.length}: ${error.message}`,
      );
    }

    deleted += batch.length;
    console.log(
      `Pruned batch ${batchIndex + 1}/${batches.length} (${deleted}/${movementIds.length})`,
    );
  }

  return deleted;
}

async function insertBatches(supabase, records, batchSize, label) {
  const batches = chunk(records, batchSize);
  let completed = 0;

  for (const [batchIndex, batch] of batches.entries()) {
    const { error } = await supabase.from('movements').insert(batch);
    if (error) {
      throw new Error(
        `${label} failed on batch ${batchIndex + 1}/${batches.length}: ${error.message}`,
      );
    }

    completed += batch.length;
    console.log(
      `${label} batch ${batchIndex + 1}/${batches.length} (${completed}/${records.length})`,
    );
  }

  return completed;
}

async function upsertBatches(supabase, records, batchSize, label) {
  const batches = chunk(records, batchSize);
  let completed = 0;

  for (const [batchIndex, batch] of batches.entries()) {
    const { error } = await supabase
      .from('movements')
      .upsert(batch, { onConflict: 'id' });
    if (error) {
      throw new Error(
        `${label} failed on batch ${batchIndex + 1}/${batches.length}: ${error.message}`,
      );
    }

    completed += batch.length;
    console.log(
      `${label} batch ${batchIndex + 1}/${batches.length} (${completed}/${records.length})`,
    );
  }

  return completed;
}

/** Keep the last CSV row when the spreadsheet repeats a movement name. */
function dedupeRecordsByMovement(records) {
  const byName = new Map();
  const duplicateNames = new Set();

  for (const record of records) {
    if (byName.has(record.Movement)) {
      duplicateNames.add(record.Movement);
    }
    byName.set(record.Movement, record);
  }

  if (duplicateNames.size > 0) {
    console.log(
      `Warning: ${duplicateNames.size} duplicate movement name(s) in CSV; kept the last row for each.`,
    );
    [...duplicateNames].sort().forEach((name) => {
      console.log(`  ${name}`);
    });
  }

  return [...byName.values()];
}

function printUsage() {
  console.log(`Usage: node scripts/ingest-movements.mjs [--file] <csv-path> [options]

Options:
  --file <path>       Path to the Functional Fitness Exercises CSV
  --dry-run           Parse and validate only; do not write to Supabase
  --truncate          Clear functional_movement_id on user_movements, then delete
                      all movements rows before insert (full catalog rebuild)
  --sync              Match rows by Movement name: update existing rows in place
                      (preserves UUIDs and user_movements links) and insert new ones
  --prune             With --sync: delete catalog rows whose Movement name is not
                      in the CSV (clears user_movements.functional_movement_id first)
  --batch-size <n>    Insert/upsert batch size (default: 500)
  --strict            Fail if any enum value cannot be mapped

  Use --sync for routine catalog updates. Add --prune when the spreadsheet removed
  exercises. Use --truncate only for a full rebuild.

Environment:
  SUPABASE_URL                Supabase project URL (falls back to VITE_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY   Service role key (required unless --dry-run)

Examples:
  node scripts/ingest-movements.mjs ~/Downloads/Functional\\ Fitness\\ Exercise\\ Database\\ version\\ 2.9\\ \\(Google\\ Sheets\\)\\ -\\ Exercises.csv --dry-run
  node scripts/ingest-movements.mjs --file ./exercises.csv --sync --prune
  node scripts/ingest-movements.mjs --file ./exercises.csv --truncate
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.file) {
    printUsage();
    process.exit(1);
  }

  if (options.truncate && options.sync) {
    throw new Error('Use either --sync or --truncate, not both.');
  }

  if (options.prune && !options.sync) {
    throw new Error('--prune requires --sync.');
  }

  if (options.prune && options.truncate) {
    throw new Error('--prune cannot be used with --truncate.');
  }

  const csvPath = resolve(options.file);
  const warnings = { skippedValues: new Map() };
  const parsedRows = parseCsvRows(csvPath);
  const records = dedupeRecordsByMovement(
    parsedRows.map((row) => rowToMovementRecord(row, warnings)),
  );

  console.log(`Parsed ${records.length} movements from ${csvPath}`);

  if (warnings.skippedValues.size > 0) {
    console.log('\nEnum values set to null because they are missing from the database schema:');
    [...warnings.skippedValues.entries()]
      .sort((left, right) => right[1] - left[1])
      .forEach(([message, count]) => {
        console.log(`  ${count}x ${message}`);
      });

    if (options.strict) {
      process.exit(1);
    }
  }

  if (options.dryRun) {
    if (options.sync) {
      console.log('\nDry run (--sync): would update existing rows and insert new ones.');
      if (options.prune) {
        console.log('Would also delete catalog rows not present in the CSV.');
      }
    } else if (options.truncate) {
      console.log('\nDry run (--truncate): would replace the entire catalog.');
    } else {
      console.log('\nDry run: would insert all rows (fails if catalog already exists).');
    }
    console.log('Sample row:');
    console.log(JSON.stringify(records[0], null, 2));
    return;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required. Run `supabase status -o env` for local credentials.',
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (options.truncate) {
    const { error: unlinkError } = await supabase
      .from('user_movements')
      .update({ functional_movement_id: null })
      .not('functional_movement_id', 'is', null);

    if (unlinkError) {
      throw new Error(
        `Failed to clear user_movements.functional_movement_id before truncate: ${unlinkError.message}`,
      );
    }

    const { error: deleteError } = await supabase
      .from('movements')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      throw deleteError;
    }

    console.log('Truncated existing movements.');
  }

  if (options.sync) {
    const { byName: existingByName, duplicateIds } =
      await fetchExistingMovementIds(supabase);

    if (duplicateIds.length > 0) {
      await removeDuplicateMovementIds(supabase, duplicateIds, options.batchSize);
    }

    const { toInsert, toUpdate } = partitionRecordsForSync(records, existingByName);
    const csvNames = csvMovementNames(records);
    const toPrune = options.prune
      ? findMovementsToPrune(existingByName, csvNames)
      : [];

    console.log(
      `Sync plan: ${toUpdate.length} update(s), ${toInsert.length} insert(s) (${existingByName.size} existing in database).`,
    );

    if (options.prune) {
      console.log(`Prune plan: ${toPrune.length} delete(s) not present in CSV.`);
      if (toPrune.length > 0 && toPrune.length <= 20) {
        toPrune.forEach(({ name }) => {
          console.log(`  ${name}`);
        });
      } else if (toPrune.length > 20) {
        toPrune.slice(0, 10).forEach(({ name }) => {
          console.log(`  ${name}`);
        });
        console.log(`  ... and ${toPrune.length - 10} more`);
      }
    }

    let updated = 0;
    let inserted = 0;
    let pruned = 0;

    if (toUpdate.length > 0) {
      updated = await upsertBatches(supabase, toUpdate, options.batchSize, 'Updated');
    }

    if (toInsert.length > 0) {
      inserted = await insertBatches(supabase, toInsert, options.batchSize, 'Inserted');
    }

    if (toPrune.length > 0) {
      const movementIds = toPrune.map(({ id }) => id);
      await unlinkUserMovementsFromMovementIds(supabase, movementIds);
      pruned = await deleteMovementsById(supabase, movementIds, options.batchSize);
    }

    const summary = [`Updated ${updated}`, `inserted ${inserted}`];
    if (options.prune) {
      summary.push(`pruned ${pruned}`);
    }
    console.log(`Done. ${summary.join(', ')} movements.`);
    return;
  }

  const inserted = await insertBatches(
    supabase,
    records,
    options.batchSize,
    'Inserted',
  );

  console.log(`Done. Inserted ${inserted} movements.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
