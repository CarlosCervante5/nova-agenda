'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  api,
  PosCatalogService,
  PosCustomer,
  PosProduct,
  PosSale,
} from '@/lib/api';
import { POS_DISCOUNT_PERCENTS, POS_METHODS, money, saleMethodLabel } from '@/lib/pos-format';

type CartLine = {
  key: string;
  kind: 'SERVICE' | 'PRODUCT' | 'CUSTOM';
  name: string;
  unitPrice: number;
  quantity: number;
  serviceId?: string;
  productId?: string;
};

type SplitRow = { method: string; amount: string };

function roundMoney(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export default function PosRegister({ compact = false, onSale }: { compact?: boolean; onSale?: () => void }) {
  const [services, setServices] = useState<PosCatalogService[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState('CASH');
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<SplitRow[]>([
    { method: 'CASH', amount: '' },
    { method: 'CARD', amount: '' },
  ]);
  const [received, setReceived] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [lastSale, setLastSale] = useState<PosSale | null>(null);

  async function loadCustomers() {
    const list = await api.getPosCustomers();
    setCustomers(list);
    return list;
  }

  useEffect(() => {
    Promise.all([api.getPosCatalog(), loadCustomers()])
      .then(([catalog]) => {
        setServices(catalog.services);
        setProducts(catalog.products);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'No se pudo cargar el catálogo');
      });
  }, []);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;
  const subtotal = roundMoney(cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
  const discountNum = roundMoney(subtotal * discountPercent / 100);
  const total = Math.max(0, roundMoney(subtotal - discountNum));

  const paidSplits = splits.map((row) => ({
    method: row.method,
    amount: roundMoney(Number(row.amount) || 0),
  }));
  const paidTotal = roundMoney(paidSplits.reduce((sum, row) => sum + row.amount, 0));
  const remaining = roundMoney(total - paidTotal);
  const cashAmount = splitMode
    ? paidSplits.filter((row) => row.method === 'CASH').reduce((sum, row) => sum + row.amount, 0)
    : method === 'CASH' ? total : 0;
  const usesCash = cashAmount > 0;
  const receivedNum = Number(received) || 0;
  const change = usesCash && receivedNum > 0 ? Math.max(0, roundMoney(receivedNum - cashAmount)) : 0;
  const splitOk = !splitMode || total === 0 || Math.abs(remaining) < 0.02;

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [services, search]);
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [products, search]);

  function addLine(line: Omit<CartLine, 'key' | 'quantity'> & { quantity?: number }) {
    setCart((prev) => {
      const existing = prev.find(
        (l) => l.kind === line.kind && l.name === line.name && l.unitPrice === line.unitPrice && l.serviceId === line.serviceId && l.productId === line.productId
      );
      if (existing) {
        return prev.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { ...line, quantity: line.quantity || 1, key: `${line.kind}-${line.serviceId || line.productId || line.name}-${Date.now()}` }];
    });
    setMessage('');
  }

  function setQty(key: string, quantity: number) {
    if (quantity < 1) {
      setCart((prev) => prev.filter((l) => l.key !== key));
      return;
    }
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, quantity } : l)));
  }

  function enableSplit() {
    const second = POS_METHODS.find((m) => m.value !== method)?.value || 'CARD';
    setSplitMode(true);
    setSplits([
      { method, amount: total ? String(roundMoney(total / 2)) : '' },
      { method: second, amount: total ? String(roundMoney(total - roundMoney(total / 2))) : '' },
    ]);
  }

  function updateSplit(index: number, patch: Partial<SplitRow>) {
    setSplits((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addSplitRow() {
    const used = new Set(splits.map((s) => s.method));
    const next = POS_METHODS.find((m) => !used.has(m.value));
    if (!next) return;
    setSplits((prev) => [...prev, { method: next.value, amount: remaining > 0 ? String(remaining) : '' }]);
  }

  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!customerForm.name.trim()) return;
    setSavingCustomer(true);
    setMessage('');
    try {
      const created = await api.createPosCustomer({
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim() || undefined,
        email: customerForm.email.trim() || undefined,
      });
      const list = await loadCustomers();
      const match = list.find((c) => c.id === created.id)
        || list.find((c) => c.phone && c.phone === created.phone)
        || created;
      setSelectedCustomerId(match.id);
      setCustomerForm({ name: '', phone: '', email: '' });
      setShowCustomerModal(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo registrar el cliente');
    } finally {
      setSavingCustomer(false);
    }
  }

  async function checkout() {
    if (cart.length === 0 || !splitOk) return;
    setSaving(true);
    setMessage('');
    try {
      const payments = splitMode
        ? paidSplits.filter((row) => row.amount > 0)
        : total > 0 ? [{ method, amount: total }] : [];
      const sale = await api.createPosSale({
        customerName: selectedCustomer?.name || undefined,
        customerPhone: selectedCustomer?.phone || undefined,
        discountPercent,
        paymentMethod: payments.length <= 1 ? (payments[0]?.method || method) : 'SPLIT',
        payments,
        notes: notes.trim() || undefined,
        receivedAmount: usesCash && receivedNum > 0 ? receivedNum : undefined,
        items: cart.map((l) => ({
          kind: l.kind,
          name: l.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          serviceId: l.serviceId,
          productId: l.productId,
        })),
      });
      setLastSale(sale);
      setCart([]);
      setSelectedCustomerId('');
      setDiscountPercent(0);
      setNotes('');
      setReceived('');
      setSplitMode(false);
      setSplits([
        { method: 'CASH', amount: '' },
        { method: 'CARD', amount: '' },
      ]);
      onSale?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cobrar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-md">
      {message && <div className="p-4 bg-error-container text-on-error-container rounded-lg">{message}</div>}

      {lastSale && (
        <div className="p-4 rounded-xl border border-secondary-container bg-secondary-container/20 flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-on-surface">Venta cobrada · {money(lastSale.total)}</p>
            <p className="font-body-sm text-on-surface-variant">
              {saleMethodLabel(lastSale)}
              {lastSale.receivedAmount ? ` · Recibido ${money(lastSale.receivedAmount)}` : ''}
            </p>
          </div>
          <button onClick={() => setLastSale(null)} className="font-label-sm text-on-surface-variant">Cerrar</button>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-gutter ${compact ? 'xl:grid-cols-[1.35fr_1fr]' : 'xl:grid-cols-[1.4fr_1fr]'}`}>
        <div className="space-y-md">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar servicio o producto…"
            className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg outline-none focus:border-primary"
          />
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg">
            <h3 className="font-headline-md text-on-surface mb-md">Servicios</h3>
            <div className="grid grid-cols-3 gap-2">
              {filteredServices.map((s) => (
                <button
                  key={s.id}
                  onClick={() => addLine({ kind: 'SERVICE', name: s.name, unitPrice: s.price || 0, serviceId: s.id })}
                  className="text-left p-3 rounded-lg border border-outline-variant hover:border-primary transition-all min-w-0"
                >
                  <p className="font-label-md text-on-surface truncate">{s.name}</p>
                  <p className="font-body-sm text-on-surface-variant">{s.duration} min · {money(s.price || 0)}</p>
                </button>
              ))}
              {filteredServices.length === 0 && <p className="font-body-sm text-on-surface-variant col-span-full">No hay servicios activos.</p>}
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg">
            <h3 className="font-headline-md text-on-surface mb-md">Productos</h3>
            <div className="grid grid-cols-3 gap-2">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addLine({ kind: 'PRODUCT', name: p.name, unitPrice: p.price, productId: p.id })}
                  className="text-left p-3 rounded-lg border border-outline-variant hover:border-primary transition-all min-w-0"
                >
                  <p className="font-label-md text-on-surface truncate">{p.name}</p>
                  <p className="font-body-sm text-on-surface-variant">{money(p.price)}</p>
                </button>
              ))}
              {filteredProducts.length === 0 && <p className="font-body-sm text-on-surface-variant col-span-full">Aún no hay productos de caja.</p>}
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg">
            <h3 className="font-headline-md text-on-surface mb-md">Cobro libre</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Concepto" className="flex-1 px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg" />
              <input type="number" min="0" step="0.01" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="Monto" className="sm:w-32 px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg" />
              <button
                type="button"
                onClick={() => {
                  if (!customName.trim() || !(Number(customPrice) > 0)) return;
                  addLine({ kind: 'CUSTOM', name: customName.trim(), unitPrice: Number(customPrice) });
                  setCustomName('');
                  setCustomPrice('');
                }}
                className="px-4 py-3 bg-surface-container-high rounded-lg font-label-md font-bold"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg h-fit xl:sticky xl:top-4">
          <h3 className="font-headline-md text-on-surface mb-md">Ticket</h3>
          {cart.length === 0 ? (
            <p className="font-body-sm text-on-surface-variant mb-lg">Toca un servicio o producto para agregarlo.</p>
          ) : (
            <ul className="space-y-2 mb-lg">
              {cart.map((line) => (
                <li key={line.key} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-on-surface truncate">{line.name}</p>
                    <p className="font-body-sm text-on-surface-variant">{money(line.unitPrice)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(line.key, line.quantity - 1)} className="w-8 h-8 rounded-lg border border-outline-variant">−</button>
                    <span className="w-6 text-center font-label-md">{line.quantity}</span>
                    <button onClick={() => setQty(line.key, line.quantity + 1)} className="w-8 h-8 rounded-lg border border-outline-variant">+</button>
                  </div>
                  <span className="w-20 text-right font-label-md">{money(line.unitPrice * line.quantity)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3 mb-lg">
            <div>
              <label className="font-label-sm text-on-surface-variant mb-1 block">Cliente</label>
              <div className="flex gap-2">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="flex-1 min-w-0 px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg outline-none focus:border-primary"
                >
                  <option value="">{customers.length === 0 ? 'No hay clientes registrados' : 'Seleccionar cliente'}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.phone ? ` · ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  title="Registrar cliente"
                  className="w-12 h-12 shrink-0 rounded-lg border border-outline-variant bg-surface-bright hover:border-primary hover:bg-primary-container/30 flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-primary">add</span>
                </button>
              </div>
            </div>

            <div>
              <label className="font-label-sm text-on-surface-variant mb-1 block">Descuento</label>
              <div className="flex flex-wrap gap-1.5">
                {POS_DISCOUNT_PERCENTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDiscountPercent(p)}
                    className={`px-3 py-2 rounded-lg border font-label-sm ${
                      discountPercent === p ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant'
                    }`}
                  >
                    {p === 0 ? 'Sin desc.' : `${p}%`}
                  </button>
                ))}
              </div>
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg min-h-[64px]" />
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className="font-label-sm text-on-surface-variant">Pago</p>
            {!splitMode ? (
              <button type="button" onClick={enableSplit} className="font-label-sm text-primary">
                Dividir pago
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSplitMode(false);
                  setMethod(splits[0]?.method || 'CASH');
                }}
                className="font-label-sm text-on-surface-variant"
              >
                Un solo método
              </button>
            )}
          </div>

          {!splitMode ? (
            <div className="grid grid-cols-3 gap-2 mb-lg">
              {POS_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`py-2 rounded-lg border font-label-sm ${method === m.value ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2 mb-lg">
              {splits.map((row, index) => (
                <div key={`${row.method}-${index}`} className="flex gap-2">
                  <select
                    value={row.method}
                    onChange={(e) => updateSplit(index, { method: e.target.value })}
                    className="flex-1 px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg"
                  >
                    {POS_METHODS.map((m) => (
                      <option key={m.value} value={m.value} disabled={splits.some((s, i) => i !== index && s.method === m.value)}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => updateSplit(index, { amount: e.target.value })}
                    placeholder="Monto"
                    className="w-28 px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg"
                  />
                  {splits.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setSplits((prev) => prev.filter((_, i) => i !== index))}
                      className="w-10 rounded-lg border border-outline-variant text-on-surface-variant"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {splits.length < POS_METHODS.length && (
                <button type="button" onClick={addSplitRow} className="font-label-sm text-primary">
                  + Otro método
                </button>
              )}
              <p className={`font-body-sm ${Math.abs(remaining) < 0.02 ? 'text-on-surface-variant' : 'text-error'}`}>
                {Math.abs(remaining) < 0.02
                  ? 'Cubierto'
                  : remaining > 0
                    ? `Falta ${money(remaining)}`
                    : `Sobra ${money(-remaining)}`}
              </p>
            </div>
          )}

          {usesCash && (
            <div className="mb-lg">
              <label className="font-label-sm text-on-surface-variant mb-1 block">
                Recibido en efectivo{splitMode ? ` (${money(cashAmount)})` : ''}
              </label>
              <input type="number" min="0" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg" />
              {receivedNum > 0 && <p className="font-body-sm mt-1">Cambio: <strong>{money(change)}</strong></p>}
            </div>
          )}

          <div className="flex justify-between font-body-sm text-on-surface-variant mb-1">
            <span>Subtotal</span><span>{money(subtotal)}</span>
          </div>
          <div className="flex justify-between font-body-sm text-on-surface-variant mb-3">
            <span>Descuento{discountPercent ? ` (${discountPercent}%)` : ''}</span><span>{money(discountNum)}</span>
          </div>
          <div className="flex justify-between font-headline-md text-on-surface mb-lg">
            <span>Total</span><span>{money(total)}</span>
          </div>
          <button
            disabled={saving || cart.length === 0 || !splitOk}
            onClick={checkout}
            className="w-full py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold disabled:opacity-50"
          >
            {saving ? 'Cobrando…' : `Cobrar ${money(total)}`}
          </button>
        </div>
      </div>

      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowCustomerModal(false)}>
          <form
            onSubmit={saveCustomer}
            className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-md border border-outline-variant"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-lg py-md border-b border-outline-variant flex items-center justify-between">
              <h3 className="font-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person_add</span>
                Registrar cliente
              </h3>
              <button type="button" onClick={() => setShowCustomerModal(false)} className="p-1 rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-lg space-y-md">
              <div>
                <label className="font-label-md text-on-surface mb-xs block">Nombre *</label>
                <input
                  required
                  autoFocus
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg outline-none focus:border-primary"
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="font-label-md text-on-surface mb-xs block">Teléfono</label>
                <input
                  type="tel"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg outline-none focus:border-primary"
                  placeholder="+52..."
                />
              </div>
              <div>
                <label className="font-label-md text-on-surface mb-xs block">Correo</label>
                <input
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg outline-none focus:border-primary"
                />
              </div>
              <button
                type="submit"
                disabled={savingCustomer || !customerForm.name.trim()}
                className="w-full py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold disabled:opacity-50"
              >
                {savingCustomer ? 'Guardando…' : 'Guardar y seleccionar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
