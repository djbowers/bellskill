import { getDisplayDate, getDuration } from './datetimes';

describe('getDisplayDate', () => {
  test('formats date with year when not current year', () => {
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
    const date = new Date('2023-06-15T12:00:00.000Z');
    expect(getDisplayDate(date)).toBe('Thursday, Jun 15 2023');
  });

  test('formats date without year when current year', () => {
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
    const date = new Date('2024-06-15T12:00:00.000Z');
    expect(getDisplayDate(date)).toBe('Saturday, Jun 15');
  });
});

describe('getDuration', () => {
  test('formats duration with hours and minutes', () => {
    const startedAt = new Date('2024-01-01T12:00:00');
    const completedAt = new Date('2024-01-01T13:15:00');
    expect(getDuration(startedAt, completedAt)).toBe('1h 15m');
  });

  test('formats duration with only minutes when less than an hour', () => {
    const startedAt = new Date('2024-01-01T12:00:00');
    const completedAt = new Date('2024-01-01T12:45:00');
    expect(getDuration(startedAt, completedAt)).toBe('45m');
  });

  test('formats duration with zero minutes when exactly on the hour', () => {
    const startedAt = new Date('2024-01-01T12:00:00');
    const completedAt = new Date('2024-01-01T13:00:00');
    expect(getDuration(startedAt, completedAt)).toBe('1h');
  });
});
