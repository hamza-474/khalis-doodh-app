export type SubscriptionPlan = "weekly" | "monthly";
export const deliveryDayCodes = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DeliveryDayCode = (typeof deliveryDayCodes)[number];

const parseDateAtNoon = (date: string) => new Date(`${date}T12:00:00Z`);

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

export function buildDeliveryDates(startDate: string, plan: SubscriptionPlan, deliveryDays: readonly DeliveryDayCode[] = deliveryDayCodes): string[] {
  const start = parseDateAtNoon(startDate);
  const count = plan === "weekly" ? 7 : 30;

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return { date, iso: toIsoDate(date) };
  }).filter(({ date }) => deliveryDays.includes(deliveryDayCodes[date.getUTCDay()])).map(({ iso }) => iso);
}

export function calculatePlanAmount(
  pricePerLitre: string | number,
  litresPerDay: number,
  plan: SubscriptionPlan,
  deliveryDays: readonly DeliveryDayCode[] = deliveryDayCodes,
): string {
  const start = plan === "weekly" ? "2026-01-04" : "2026-01-01";
  const deliveryCount = buildDeliveryDates(start, plan, deliveryDays).length;
  const amount = Number(pricePerLitre) * litresPerDay * deliveryCount;
  return amount.toFixed(2);
}

export function shouldFlagVendor(lowRatingCount: number, ratingAverage?: number): boolean {
  return lowRatingCount >= 3 || (ratingAverage !== undefined && ratingAverage < 3);
}

export function maskCnic(value: string): string {
  const digits = value.replace(/\D/g, "");
  return `•••••••••${digits.slice(-4)}`;
}
