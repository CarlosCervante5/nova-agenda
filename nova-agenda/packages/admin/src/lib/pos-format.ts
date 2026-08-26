export const POS_METHODS = [
  { value: 'CASH', label: 'Efectivo', icon: 'payments' },
  { value: 'CARD', label: 'Tarjeta', icon: 'credit_card' },
  { value: 'TRANSFER', label: 'Transferencia', icon: 'account_balance' },
];

export const POS_DISCOUNT_PERCENTS = [0, 5, 10, 15, 20, 25, 50];

export function money(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}

export function methodLabel(value: string) {
  if (value === 'SPLIT') return 'Varios métodos';
  return POS_METHODS.find((m) => m.value === value)?.label || value;
}

export function parsePaymentSplits(raw: unknown): { method: string; amount: number }[] {
  if (Array.isArray(raw)) {
    return raw
      .map((row) => ({
        method: String((row as { method?: string })?.method || ''),
        amount: Number((row as { amount?: number })?.amount) || 0,
      }))
      .filter((row) => row.method && row.amount > 0);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return parsePaymentSplits(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

export function saleMethodLabel(sale: { paymentMethod: string; paymentSplits?: unknown }) {
  const splits = parsePaymentSplits(sale.paymentSplits);
  if (splits.length > 1 || sale.paymentMethod === 'SPLIT') {
    return splits.map((s) => `${methodLabel(s.method)} ${money(s.amount)}`).join(' + ') || methodLabel('SPLIT');
  }
  return methodLabel(sale.paymentMethod);
}
