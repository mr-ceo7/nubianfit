/** "KES 8,000" / "KES 8,000.50" */
export function formatMoney(amount: number, currency = 'KES'): string {
  const whole = Math.round(amount * 100) % 100 === 0;
  return `${currency} ${amount.toLocaleString('en-KE', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export const INTERVAL_LABEL: Record<string, string> = { monthly: 'month', quarterly: 'quarter', yearly: 'year' };

export function describeBilling(p: { billing: string; interval?: string | null; durationWeeks?: number | null }): string {
  return p.billing === 'recurring'
    ? `per ${INTERVAL_LABEL[p.interval ?? 'monthly']}, renews automatically`
    : `one-time · ${p.durationWeeks ?? 12} weeks`;
}
