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

describe('formatEquipmentSection', () => {
  it('renders nothing when the user has no equipment', () => {
    expect(formatEquipmentSection(null)).toBe('');
    expect(formatEquipmentSection(summary([]))).toBe('');
  });

  it('lists what they own, what loads, and where doubles work', () => {
    const section = formatEquipmentSection(
      summary([fixed(16, 2), fixed(24), fixed(32)]),
    );

    expect(section).toContain('AVAILABLE EQUIPMENT');
    expect(section).toContain('Owns: 16 kg (pair), 24 kg, 32 kg');
    expect(section).toContain('Loadable weights: 16kg, 24kg, 32kg');
    expect(section).toContain('Doubles possible at: 16kg');
    expect(section).toContain('Prescribe only weights from the loadable list');
  });

  it('says so when no weight has a second bell', () => {
    const section = formatEquipmentSection(summary([fixed(24)]));

    expect(section).toContain('Doubles possible at: none');
  });
});
