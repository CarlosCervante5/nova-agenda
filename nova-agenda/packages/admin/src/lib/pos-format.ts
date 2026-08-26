export const POS_METHODS = [
  { value: 'CASH', label: 'Efectivo', icon: 'payments' },
  { value: 'CARD', label: 'Tarjeta', icon: 'credit_card' },
  { value: 'TRANSFER', label: 'Transferencia', icon: 'account_balance' },
];

export function money(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}

export function methodLabel(value: string) {
  return POS_METHODS.find((m) => m.value === value)?.label || value;
}
