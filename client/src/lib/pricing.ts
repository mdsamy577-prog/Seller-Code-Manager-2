import { useQuery } from "@tanstack/react-query";

export const personalPrices: Record<string, number> = {
  "1": 200, "2": 380, "3": 550, "4": 700, "5": 850, "6": 1000,
  "7": 1100, "8": 1200, "9": 1300, "10": 1400, "11": 1500, "12": 1600,
};

export const businessPrices: Record<string, number> = {
  "1": 300, "2": 550, "3": 800, "4": 1000, "5": 1200, "6": 1400,
  "7": 1600, "8": 1800, "9": 2000, "10": 2200, "11": 2400, "12": 2600,
};

const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBengaliNumeral(n: number): string {
  return String(Math.round(n))
    .split("")
    .map((d) => BENGALI_DIGITS[parseInt(d)])
    .join("");
}

export function formatPrice(amount: number): string {
  return `${toBengaliNumeral(amount)} টাকা`;
}

export function discountedAmount(original: number, discountPct: number): number {
  return Math.round(original * (1 - discountPct / 100));
}

export function useDiscount(): number {
  const { data } = useQuery<{ discount: number }>({
    queryKey: ["/api/settings/discount"],
    staleTime: 30_000,
  });
  return data?.discount ?? 0;
}
