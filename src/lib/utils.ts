import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toPublicNumericId(value: string | null | undefined): string {
  if (!value) return "-";

  const normalized = value.replace(/-/g, "").trim();
  if (!normalized) return "-";

  try {
    const asBigInt = BigInt(`0x${normalized}`);
    const tenDigits = asBigInt % 10000000000n;
    return tenDigits.toString().padStart(10, "0");
  } catch {
    // Fallback for non-UUID values.
    const digits = normalized.replace(/\D/g, "").slice(0, 10);
    return digits.padStart(10, "0") || "-";
  }
}
