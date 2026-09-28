/**
 * Date helpers for the weekly plan engine (Mon..Sun weeks, UTC-normalized).
 * Includes the shared timezone-aware "today" computation (Fase 2: single
 * today resolution used by plan state and home).
 */
import { DayOfWeek } from '@prisma/client';

export interface TimezoneDayInfo {
  dayOfWeek: DayOfWeek;
  dateString: string;
  effectiveTimezone: string;
}

/** Canonical Monday..Sunday order shared by schedule readers/writers. */
export const DAYS_OF_WEEK_ORDER: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

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
 * Calculates the dayOfWeek and YYYY-MM-DD date in the user's timezone for a
 * given baseDate. Defaults to 'UTC' if timeZoneInput is missing or invalid.
 */
export function resolveDayInTimezone(
  timeZoneInput?: string,
  baseDate: Date = new Date(),
): TimezoneDayInfo {
  let effectiveTimezone = 'UTC';

  if (timeZoneInput && timeZoneInput.trim().length > 0) {
    const candidate = timeZoneInput.trim();
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: candidate });
      effectiveTimezone = candidate;
    } catch {
      effectiveTimezone = 'UTC';
    }
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: effectiveTimezone,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(baseDate);
  const weekdayStr = parts
    .find((p) => p.type === 'weekday')
    ?.value?.toUpperCase();
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  const dayOfWeek = (weekdayStr as DayOfWeek) || DayOfWeek.MONDAY;
  const dateString = `${year}-${month}-${day}`;

  return {
    dayOfWeek,
    dateString,
    effectiveTimezone,
  };
}

export function parseWeekStartDate(input?: string): Date {
  // Parses YYYY-MM-DD or ISO 8601 string and returns the Monday of that week.
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
