export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);

/**
 * Safely parse a date string as local time.
 * Date-only strings ("2026-05-05") are treated as local midnight, NOT UTC midnight,
 * preventing the off-by-one-day bug in US timezones.
 * Full timestamps ("2026-05-05T13:00:00Z") are passed through unchanged.
 */
export const parseDateStr = (d: string): Date =>
  new Date(d.includes("T") ? d : `${d}T00:00:00`);
