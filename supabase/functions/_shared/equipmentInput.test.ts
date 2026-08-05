import { describe, expect, it } from 'vitest';

import { summarizeEquipment } from '../../../src/utils/equipment.ts';
import { formatEquipmentSection } from './equipmentInput.ts';

const summary = (rows: Parameters<typeof summarizeEquipment>[0]) =>
  summarizeEquipment(rows);

const fixed = (weight: number, quantity = 1) => ({
  kind: 'fixed' as const,
  weight,
  minWeight: null,
  maxWeight: null,
  stepWeight: null,
  unit: 'kilograms' as const,
  quantity,
});

const adjustable = (
  minWeight: number,
  maxWeight: number,
  stepWeight: number,
  quantity = 1,
) => ({
  kind: 'adjustable' as const,
  weight: null,
  minWeight,
  maxWeight,
  stepWeight,
  unit: 'kilograms' as const,
  quantity,
});

describe('formatEquipmentSection', () => {
  it('renders nothing when the user has no equipment', () => {
    expect(formatEquipmentSection(null)).toBe('');
    expect(formatEquipmentSection(summary([]))).toBe('');
  });

  it('lists fixed bells as freely swappable within a session', () => {
    const section = formatEquipmentSection(
      summary([fixed(16, 2), fixed(24), fixed(32)]),
    );

    expect(section).toContain('AVAILABLE EQUIPMENT');
    expect(section).toContain('Owns: 16 kg (pair), 24 kg, 32 kg');
    expect(section).toContain(
      'Fixed bells, usable at any point in the session: 16kg (pair — doubles OK), 24kg, 32kg',
    );
    expect(section).toContain('swapped freely');
    // Nothing about re-plating when there is nothing to re-plate.
    expect(section).not.toContain('Adjustable bells:');
  });

  it('pins an adjustable bell to one setting for the whole session', () => {
    const section = formatEquipmentSection(summary([adjustable(12, 20, 4)]));

    expect(section).toContain('Adjustable bells: 1.');
    expect(section).toContain('12kg, 16kg, 20kg');
    expect(section).toContain('holds ONE setting for the entire session');
    expect(section).toContain('never done mid-workout');
    expect(section).toContain('Use at most 1 distinct adjustable weight');
    expect(section).toContain(
      'With one adjustable bell, double-bell work is only possible using fixed pairs.',
    );
  });

  it('allows one setting per adjustable bell, and doubles only on both', () => {
    const section = formatEquipmentSection(
      summary([adjustable(12, 32, 2, 2)]),
    );

    expect(section).toContain('Adjustable bells: 2.');
    expect(section).toContain('Use at most 2 distinct adjustable weights');
    expect(section).toContain(
      'requires both bells at the same setting, which uses up both',
    );
  });

  it('never presents adjustable settings as freely mixable weights', () => {
    const section = formatEquipmentSection(
      summary([fixed(16, 2), adjustable(12, 32, 2, 2)]),
    );

    // The fixed line must not absorb the adjustable settings — that is what
    // would license re-plating between blocks.
    const fixedLine = section
      .split('\n')
      .find((line) => line.startsWith('Fixed bells, usable'))!;
    expect(fixedLine).toBe(
      'Fixed bells, usable at any point in the session: 16kg (pair — doubles OK)',
    );
    expect(fixedLine).not.toContain('12kg');
    expect(fixedLine).not.toContain('32kg');
    expect(section).toContain('never prescribe two different weights from the same adjustable bell');
  });
});
