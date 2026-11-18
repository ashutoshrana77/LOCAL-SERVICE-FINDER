export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, string>;

  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isNonEmptyString(value: unknown, min = 1, max = 500): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) && trimmed.length <= 160;
}

export function isValidIndianPhone(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const digits = value.replace(/[\s\-+()]/g, '');
  return /^(91)?[6-9]\d{9}$/.test(digits);
}

export function isValidPincode(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^[1-9]\d{5}$/.test(value.trim());
}

export function parsePositiveInt(value: unknown, fallback: number, min = 1, max = 1000): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min) return fallback;
  return Math.min(Math.floor(num), max);
}

export function formatTimeAgoLabel(minutes: number): string {
  if (minutes < 60) return `Within ${minutes} mins`;
  const hours = Math.round(minutes / 60);
  return `Within ${hours} hr${hours > 1 ? 's' : ''}`;
}

export const BOOKING_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'RESCHEDULED',
  'COMPLETED',
  'CANCELLED',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const QUOTE_STATUSES = [
  'PENDING',
  'QUOTED',
  'ACCEPTED',
  'DECLINED',
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
