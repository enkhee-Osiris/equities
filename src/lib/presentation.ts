import Decimal from "decimal.js";
import { formatMoney } from "./portfolio";

export const allocationColors = [
  "#316c5b",
  "#7b94b8",
  "#a5b9ae",
  "#a8a0bd",
  "#d4b786",
  "#7ba9ab",
];

export function dateLabel(date: string, year = false): string {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      ...(year ? { year: "numeric" } : {}),
      timeZone: "UTC",
    },
  );
}
export function tone(value: Decimal | null): string {
  if (value?.isPositive()) return "positive";
  if (value?.isNegative()) return "negative";
  return "";
}

export function signed(value: Decimal | null): string {
  if (value === null) return "—";
  return `${value.isPositive() ? "+" : ""}${formatMoney(value, 2)}`;
}

export function quantity(value: string): string {
  const [whole, fraction] = new Decimal(value).toFixed().split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return grouped + (fraction ? `.${fraction}` : "");
}

export function ageDays(date: string): number {
  return Math.floor(
    (Date.now() - new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime()) /
      86_400_000,
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
