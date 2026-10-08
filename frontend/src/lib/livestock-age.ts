export interface DerivedLivestockAge {
  years: number;
  months: number;
  total_months: number;
}

/** Format an API calendar date without converting it through a UTC timestamp. */
export function formatCalendarDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10));
  if (!match) return value;
  const [, year, month, day] = match;
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1, Number(day)));
}

/** Display the age calculated by the backend. This helper never calculates age. */
export function formatLivestockAge(age: DerivedLivestockAge | null | undefined): string {
  if (!age) return "Unknown";
  const parts: string[] = [];
  if (age.years > 0) parts.push(`${age.years} ${age.years === 1 ? "year" : "years"}`);
  if (age.months > 0 || parts.length === 0) parts.push(`${age.months} ${age.months === 1 ? "month" : "months"}`);
  return parts.join(", ");
}

export function formatAgeClassification(value: string | null | undefined): string {
  if (!value || value === "UNKNOWN") return "Unknown";
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function localCalendarDateToday(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
