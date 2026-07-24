import { DateTime } from 'luxon';

import { getRowDateLabel } from './dayLabels';

describe('getRowDateLabel', () => {
  test('names today and yesterday the way a person would', () => {
    expect(getRowDateLabel(new Date())).toBe('Today');
    expect(
      getRowDateLabel(DateTime.now().minus({ days: 1 }).toJSDate()),
    ).toBe('Yesterday');
  });

  test('falls back to weekday and date once further back', () => {
    expect(getRowDateLabel(new Date('2023-11-09T12:00:00'))).toBe('Thu 9');
  });

  test('ignores time of day when deciding how recent a date is', () => {
    const lateToday = DateTime.now().startOf('day').plus({ hours: 23 });
    expect(getRowDateLabel(lateToday.toJSDate())).toBe('Today');
  });
});
