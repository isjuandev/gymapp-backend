/**
 * Normalizes any given date to the Monday of its week at 00:00:00.000 UTC.
 * Consistent with Mon..Sun week representation.
 */
export function getMondayOfWeek(dateInput: Date = new Date()): Date {
  const date = new Date(dateInput);
  const day = date.getUTCDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  // Distance to Monday (if Sunday (0), move back 6 days; otherwise move back (day - 1))
  const diffToMonday = day === 0 ? -6 : 1 - day;

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + diffToMonday,
      0,
      0,
      0,
      0,
    ),
  );
}

/**
 * Adds an integer number of days to a date in UTC.
 */
export function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Parses YYYY-MM-DD or ISO 8601 string and returns the Monday of that week.
 */
export function parseWeekStartDate(input?: string): Date {
  if (!input) {
    return getMondayOfWeek(new Date());
  }

  // Handle YYYY-MM-DD or full ISO
  const parts = input.split('T')[0].split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const parsed = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    return getMondayOfWeek(parsed);
  }

  return getMondayOfWeek(new Date(input));
}
