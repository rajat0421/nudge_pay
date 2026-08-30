import { fromZonedTime } from "date-fns-tz";

/**
 * All calendar-only fields (issueDate, dueDate) are stored as UTC-midnight
 * Date objects that represent a *calendar day*, not a specific instant —
 * e.g. "2026-09-04" is stored as new Date("2026-09-04T00:00:00.000Z"). Read
 * the Y/M/D back out with the UTC getters, never the local ones.
 */
export function toCalendarDate(input: string | Date): Date {
  const value = typeof input === "string" ? input : input.toISOString();
  const isoDateOnly = value.slice(0, 10);
  return new Date(`${isoDateOnly}T00:00:00.000Z`);
}

/**
 * Pure calendar-day arithmetic performed on the UTC timeline so it can never
 * be shifted by the server process's local timezone or DST transitions.
 */
export function addCalendarDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days),
  );
}

/**
 * Resolves the actual UTC instant of local midnight, in the organization's
 * timezone, for the given calendar date. This is what reminder scheduling
 * uses so "2 days after the due date" fires at midnight in the org's own
 * timezone rather than the server's.
 */
export function orgLocalMidnightUtc(calendarDate: Date, timeZone: string): Date {
  const y = calendarDate.getUTCFullYear();
  const m = String(calendarDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(calendarDate.getUTCDate()).padStart(2, "0");
  return fromZonedTime(`${y}-${m}-${d}T00:00:00`, timeZone);
}

/**
 * True once the organization's local "end of day" for `calendarDate` has
 * passed relative to `now` — i.e. the invoice is now overdue.
 */
export function isCalendarDatePastInOrgTimezone(
  calendarDate: Date,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  const startOfNextDay = orgLocalMidnightUtc(addCalendarDays(calendarDate, 1), timeZone);
  return now.getTime() >= startOfNextDay.getTime();
}

export function formatCalendarDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
