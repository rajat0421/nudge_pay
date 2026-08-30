const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Parses short duration strings like "15m", "30d", "2h" into milliseconds. */
export function parseDurationToMs(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration string: "${duration}"`);
  }
  // Non-null: the regex match guarantees both groups captured.
  const amount = match[1]!;
  const unit = match[2]!;
  return Number(amount) * UNIT_MS[unit]!;
}
