/**
 * Amounts are always persisted and passed around as integer minor units
 * (e.g. cents for USD) — see business rule #8. These helpers are the only
 * place major/minor conversion happens, and only at the API edge.
 */
export function majorToMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function minorToMajorUnits(amountMinor: number): number {
  return amountMinor / 100;
}

export function formatMinorUnits(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minorToMajorUnits(amountMinor));
}
