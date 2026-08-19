import { auth } from "$lib/auth.svelte";
import { toIntlLocale } from "$lib/constants/language-to-locale";
import { m } from "$lib/paraglide/messages.js";

function resolveLocale(locale?: string) {
  return locale ?? toIntlLocale(auth.user?.locale);
}

const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let fmt = dateTimeFormatCache.get(key);

  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options);
    dateTimeFormatCache.set(key, fmt);
  }

  return fmt;
}

const numberFormatCache = new Map<string, Intl.NumberFormat>();

function getNumberFormat(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let fmt = numberFormatCache.get(key);

  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options);
    numberFormatCache.set(key, fmt);
  }

  return fmt;
}

/** Default `formatDate` shape, e.g. "03/01/2026". */
export const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

/** e.g. "3 janv. 2026" — for revision/episode lists. */
export const DATE_MEDIUM_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

/** e.g. "janvier 2026" — for a month-granularity date (release date, "membre depuis"). */
export const MONTH_YEAR_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "long",
  year: "numeric",
};

/** e.g. "janv." — for chart axis labels / table headers. */
export const MONTH_SHORT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
};

/** Default `formatTime` shape, e.g. "14:32". */
export const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

/** Default `formatDateTime` shape, e.g. "3 janv. 2026, 14:32". */
export const DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

/** e.g. "3 janvier 2026 à 14:32" — for a relative-time hover tooltip. */
export const DATETIME_LONG_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "long",
  timeStyle: "short",
};

/** e.g. "03/01/2026 14:32" — for compact tabular date+time. */
export const DATETIME_NUMERIC_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/** Formats a date as e.g. "03/01/2026" by default. Accepts an ISO string or a `Date`. */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = DATE_OPTIONS,
  locale?: string,
): string {
  return getDateTimeFormat(resolveLocale(locale), options).format(
    new Date(date),
  );
}

/** Formats a date as a time, e.g. "14:32" by default. Accepts an ISO string or a `Date`. */
export function formatTime(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = TIME_OPTIONS,
  locale?: string,
): string {
  return getDateTimeFormat(resolveLocale(locale), options).format(
    new Date(date),
  );
}

/** Formats a date as a date + time, e.g. "3 janv. 2026, 14:32" by default. Accepts an ISO string or a `Date`. */
export function formatDateTime(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = DATETIME_OPTIONS,
  locale?: string,
): string {
  return getDateTimeFormat(resolveLocale(locale), options).format(
    new Date(date),
  );
}

/** e.g. "42 %" — rounded percentage. */
export const PERCENT_OPTIONS: Intl.NumberFormatOptions = {
  style: "percent",
  maximumFractionDigits: 0,
};

/** Formats a number, plain grouped notation by default (e.g. "12 345"). */
export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale?: string,
): string {
  return getNumberFormat(resolveLocale(locale), options).format(value);
}

const relativeTimeFormatCache = new Map<string, Intl.RelativeTimeFormat>();

function getRelativeTimeFormat(locale: string): Intl.RelativeTimeFormat {
  let fmt = relativeTimeFormatCache.get(locale);

  if (!fmt) {
    fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    relativeTimeFormatCache.set(locale, fmt);
  }

  return fmt;
}

/**
 * Compact relative time, e.g. "il y a 2 h", "hier". Falls back to an absolute
 * date past a week, where "il y a 9 j" reads worse than the plain date.
 */
export function formatRelative(iso: string, locale?: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const resolved = resolveLocale(locale);

  if (abs < 60) return m.common_just_now();
  const relFmt = getRelativeTimeFormat(resolved);
  if (abs < 3600) return relFmt.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return relFmt.format(Math.round(diffSec / 3600), "hour");
  if (abs < 604_800) return relFmt.format(Math.round(diffSec / 86_400), "day");
  return formatDate(iso, DATE_OPTIONS, resolved);
}

const BYTE_UNITS = ["Ko", "Mo", "Go"];

/** Byte size in the largest unit that keeps it readable, e.g. "218 Mo", "1,4 Go". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;

  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value.toFixed(value < 10 ? 1 : 0)} ${BYTE_UNITS[unit]}`.replace(
    ".",
    ",",
  );
}
