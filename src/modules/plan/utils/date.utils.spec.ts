import { getMondayOfWeek, addDaysUTC, parseWeekStartDate } from './date.utils';

describe('date.utils', () => {
  describe('getMondayOfWeek', () => {
    it('should return Monday when given a Monday', () => {
      // 2026-09-21 is Monday
      const monday = new Date(Date.UTC(2026, 8, 21, 14, 30));
      const result = getMondayOfWeek(monday);
      expect(result.getUTCDay()).toBe(1); // Monday
      expect(result.getUTCDate()).toBe(21);
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it('should return Monday when given a Thursday', () => {
      // 2026-09-24 is Thursday
      const thursday = new Date(Date.UTC(2026, 8, 24, 18, 0));
      const result = getMondayOfWeek(thursday);
      expect(result.getUTCDay()).toBe(1);
      expect(result.getUTCDate()).toBe(21);
    });

    it('should return Monday when given a Sunday (end of week)', () => {
      // 2026-09-27 is Sunday
      const sunday = new Date(Date.UTC(2026, 8, 27, 23, 59));
      const result = getMondayOfWeek(sunday);
      expect(result.getUTCDay()).toBe(1);
      expect(result.getUTCDate()).toBe(21);
    });
  });

  describe('addDaysUTC', () => {
    it('should correctly advance dates across month boundaries', () => {
      const date = new Date(Date.UTC(2026, 8, 30, 0, 0)); // Sep 30
      const nextDay = addDaysUTC(date, 1);
      expect(nextDay.getUTCMonth()).toBe(9); // Oct (0-indexed 9)
      expect(nextDay.getUTCDate()).toBe(1);
    });
  });

  describe('parseWeekStartDate', () => {
    it('should parse YYYY-MM-DD string and normalize to Monday', () => {
      const result = parseWeekStartDate('2026-09-23'); // Wednesday
      expect(result.getUTCDay()).toBe(1); // Monday
      expect(result.getUTCDate()).toBe(21);
    });

    it('should default to current Monday when no input given', () => {
      const result = parseWeekStartDate();
      expect(result.getUTCDay()).toBe(1);
    });
  });
});
