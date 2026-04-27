import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, isValid } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a hex color string to HSL components (space-separated)
 * suitable for CSS variables used by Tailwind/Shadcn.
 * e.g., "#4285F4" -> "217 89% 61%"
 */
export function hexToHsl(hex: string): string {
  // Remove the hash if it exists
  hex = hex.replace(/^#/, '');

  // Parse r, g, b values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  return `${hDeg} ${sPct}% ${lPct}%`;
}

/**
 * Formats a numeric value as AUD currency.
 */
export function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

/**
 * Safely formats a date string or timestamp.
 */
export function formatDate(date: any, formatStr: string = 'dd MMM yyyy'): string {
  if (!date) return 'N/A';
  
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string') {
    d = parseISO(date);
  } else if (date?.toDate) {
    d = date.toDate();
  } else if (date?.seconds) {
    d = new Date(date.seconds * 1000);
  } else {
    return 'Invalid Date';
  }

  return isValid(d) ? format(d, formatStr) : 'Invalid Date';
}

export function isServiceEnabledForCompany(serviceName: any, company: any, role?: any): boolean {
    return true; // UNIVERSAL ACCESS ENABLED
}

export function normalizeServiceName(name: string): any {
    return name.replace(/^Customer\s+/, '');
}
