'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { use } from 'react';

interface CatalogService {
  id: string;
  name: string;
  price?: number | null;
  duration: number;
  color: string;
}
interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  sku?: string | null;
  isActive: boolean;
}

type CartLine = {
  key: string;
  kind: 'SERVICE' | 'PRODUCT' | 'CUSTOM';
  name: string;
  unitPrice: number;
  quantity: number;
  serviceId?: string;
  productId?: string;
};
type Tab = 'caja' | 'historial';
type PosCustomer = { id: string; name: string; phone?: string | null; email?: string | null };
type SplitRow = { method: string; amount: string };

const METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
];
const DISCOUNT_PERCENTS = [0, 5, 10, 15, 20, 25, 50];

function money(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}
function roundMoney(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
function methodLabel(v: string) {
  if (v === 'SPLIT') return 'Varios métodos';
  return METHODS.find((m) => m.value === v)?.label || v;
}
function saleMethodLabel(sale: { paymentMethod: string; paymentSplits?: { method: string; amount: number }[] }) {
  const splits = sale.paymentSplits || [];
  if (splits.length > 1 || sale.paymentMethod === 'SPLIT') {
    return splits.map((s) => `${methodLabel(s.method)} ${money(s.amount)}`).join(' + ') || methodLabel('SPLIT');
  }
  return methodLabel(sale.paymentMethod);
}

export default function PosEmbedPage(props: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = use(props.params);
  const [clientId, setClientId] = useState('');
  const [services, setServices] = useState<CatalogService[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('caja');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '' });
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/public/resolve?slug=${clientSlug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.id) {
          setClientId(d.id);
          return loadData(d.id);
        }
        setMessage('Negocio no encontrado: ' + clientSlug);
        setLoading(false);
      })
      .catch(() => {
        setMessage('Error de conexión');
        setLoading(false);
      });
  }, [clientSlug]);

  async function loadData(cid: string) {
    try {
      const [cat, prod, saleList, customerList] = await Promise.all([
        fetch(`/api/pos/catalog?clientId=${cid}`).then((r) => r.json()),
        fetch(`/api/pos/products?clientId=${cid}`).then((r) => r.json()),
        fetch(`/api/pos/sales?clientId=${cid}`).then((r) => r.json()),
        fetch(`/api/pos/customers?clientId=${cid}`).then((r) => r.json()),
      ]);
      setServices(cat.services || []);
      setProducts(cat.products || []);
      setSales(saleList || []);
      setCustomers(Array.isArray(customerList) ? customerList : []);
    } catch {
      setMessage('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;
  const subtotal = roundMoney(cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
  const discountNum = roundMoney(subtotal * discountPercent / 100);
  const total = Math.max(0, roundMoney(subtotal - discountNum));
  const paidSplits = splits.map((row) => ({ method: row.method, amount: roundMoney(Number(row.amount) || 0) }));
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
        (l) =>
          l.kind === line.kind &&
          l.name === line.name &&
          l.unitPrice === line.unitPrice &&
          l.serviceId === line.serviceId &&
          l.productId === line.productId
      );
      if (existing) return prev.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l));
      return [
        ...prev,
        { ...line, quantity: line.quantity || 1, key: `${line.kind}-${line.serviceId || line.productId || line.name}-${Date.now()}` },
      ];
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

  async function checkout() {
    if (cart.length === 0 || !clientId || !splitOk) return;
    setSaving(true);
    setMessage('');
    try {
      const payments = splitMode
        ? paidSplits.filter((row) => row.amount > 0)
        : total > 0 ? [{ method, amount: total }] : [];
      const res = await fetch('/api/pos/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          customerName: selectedCustomer?.name || undefined,
          customerPhone: selectedCustomer?.phone || undefined,
          discountPercent,
          paymentMethod: payments.length <= 1 ? (payments[0]?.method || method) : 'SPLIT',
          payments,
          receivedAmount: usesCash && receivedNum > 0 ? receivedNum : undefined,
          items: cart.map((l) => ({
            kind: l.kind,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            serviceId: l.serviceId,
            productId: l.productId,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error' }));
        throw new Error(err.error || 'No se pudo cobrar');
      }
      setCart([]);
      setSelectedCustomerId('');
      setDiscountPercent(0);
      setReceived('');
      setSplitMode(false);
      setSplits([{ method: 'CASH', amount: '' }, { method: 'CARD', amount: '' }]);
      await loadData(clientId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error al cobrar');
    } finally {
      setSaving(false);
    }
  }

  async function saveCustomer(e: FormEvent) {
    e.preventDefault();
    if (!customerForm.name.trim() || !clientId) return;
    try {
      const res = await fetch('/api/pos/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          name: customerForm.name.trim(),
          phone: customerForm.phone.trim() || undefined,
          email: customerForm.email.trim() || undefined,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || 'No se pudo registrar');
      await loadData(clientId);
      setSelectedCustomerId(created.id);
      setCustomerForm({ name: '', phone: '', email: '' });
      setShowCustomerModal(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo registrar el cliente');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        <p className="text-[#888] text-sm">Cargando punto de venta...</p>
      </div>
    );
  }

  if (message && !clientId) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        <p className="text-[#ef4444] text-sm">{message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-[#e0e0e0] font-['Inter',sans-serif] p-4">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#a855f7] to-[#6366f1] flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">point_of_sale</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{clientSlug}</h1>
              <p className="text-xs text-[#888]">Punto de Venta</p>
            </div>
          </div>
          <div className="flex gap-1 bg-[#1a1a2e] rounded-lg p-1">
            {(
              [['caja', 'Caja'], ['historial', 'Historial']] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  tab === id ? 'bg-[#12121e] text-white shadow-sm' : 'text-[#888] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <div className="p-3 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#ef4444] rounded-lg text-sm mb-4">
            {message}
          </div>
        )}

        {tab === 'caja' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
            <div className="space-y-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar servicio o producto..."
                className="w-full px-4 py-3 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white outline-none focus:border-[#a855f7] text-sm"
              />
              <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-5">
                <h3 className="text-base font-semibold text-white mb-3">Servicios</h3>
                <div className="grid grid-cols-3 gap-2 max-h-[240px] overflow-y-auto pr-1">
                  {filteredServices.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => addLine({ kind: 'SERVICE', name: s.name, unitPrice: s.price || 0, serviceId: s.id })}
                      className="text-left p-3 rounded-lg border border-[#2a2a3e] hover:border-[#a855f7] transition-all min-w-0"
                    >
                      <p className="text-sm font-medium text-white truncate">{s.name}</p>
                      <p className="text-xs text-[#888]">{s.duration} min · {money(s.price || 0)}</p>
                    </button>
                  ))}
                  {filteredServices.length === 0 && <p className="text-xs text-[#888] col-span-full">No hay servicios activos.</p>}
                </div>
              </div>
              <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-5">
                <h3 className="text-base font-semibold text-white mb-3">Productos</h3>
                <div className="grid grid-cols-3 gap-2 max-h-[240px] overflow-y-auto pr-1">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addLine({ kind: 'PRODUCT', name: p.name, unitPrice: p.price, productId: p.id })}
                      className="text-left p-3 rounded-lg border border-[#2a2a3e] hover:border-[#a855f7] transition-all min-w-0"
                    >
                      <p className="text-sm font-medium text-white truncate">{p.name}</p>
                      <p className="text-xs text-[#888]">{money(p.price)}</p>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && <p className="text-xs text-[#888] col-span-full">No hay productos de caja.</p>}
                </div>
              </div>
              <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-5">
                <h3 className="text-base font-semibold text-white mb-3">Cobro libre</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Concepto" className="flex-1 px-4 py-3 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white text-sm" />
                  <input type="number" min="0" step="0.01" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="Monto" className="sm:w-32 px-4 py-3 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white text-sm" />
                  <button
                    type="button"
                    onClick={() => {
                      if (!customName.trim() || !(Number(customPrice) > 0)) return;
                      addLine({ kind: 'CUSTOM', name: customName.trim(), unitPrice: Number(customPrice) });
                      setCustomName('');
                      setCustomPrice('');
                    }}
                    className="px-4 py-3 bg-[#2a2a3e] rounded-lg text-sm font-semibold text-white hover:bg-[#33334a]"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-5 h-fit xl:sticky xl:top-4">
              <h3 className="text-base font-semibold text-white mb-3">Ticket</h3>
              {cart.length === 0 ? (
                <p className="text-xs text-[#888] mb-6">Selecciona un servicio o producto para agregarlo.</p>
              ) : (
                <ul className="space-y-2 mb-6">
                  {cart.map((line) => (
                    <li key={line.key} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{line.name}</p>
                        <p className="text-xs text-[#888]">{money(line.unitPrice)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQty(line.key, line.quantity - 1)} className="w-8 h-8 rounded-lg border border-[#2a2a3e] text-[#888] hover:text-white">-</button>
                        <span className="w-6 text-center text-sm font-medium">{line.quantity}</span>
                        <button onClick={() => setQty(line.key, line.quantity + 1)} className="w-8 h-8 rounded-lg border border-[#2a2a3e] text-[#888] hover:text-white">+</button>
                      </div>
                      <span className="w-20 text-right text-sm font-medium">{money(line.unitPrice * line.quantity)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex gap-2">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="flex-1 min-w-0 px-4 py-3 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white text-sm"
                  >
                    <option value="">{customers.length === 0 ? 'No hay clientes registrados' : 'Seleccionar cliente'}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCustomerModal(true)}
                    className="w-12 h-12 shrink-0 rounded-lg border border-[#2a2a3e] bg-[#12121e] text-white flex items-center justify-center"
                    title="Registrar cliente"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(true)}
                  className="w-full px-4 py-3 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white text-sm flex items-center justify-between"
                >
                  <span>{discountPercent ? `Descuento ${discountPercent}%` : 'Sin descuento'}</span>
                  <span className="text-[#888]">%</span>
                </button>
              </div>

              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#888]">Pago</p>
                {!splitMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      const second = METHODS.find((m) => m.value !== method)?.value || 'CARD';
                      setSplitMode(true);
                      setSplits([
                        { method, amount: total ? String(roundMoney(total / 2)) : '' },
                        { method: second, amount: total ? String(roundMoney(total - roundMoney(total / 2))) : '' },
                      ]);
                    }}
                    className="text-xs text-[#a855f7]"
                  >
                    Dividir pago
                  </button>
                ) : (
                  <button type="button" onClick={() => { setSplitMode(false); setMethod(splits[0]?.method || 'CASH'); }} className="text-xs text-[#888]">
                    Un solo método
                  </button>
                )}
              </div>

              {!splitMode ? (
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                        method === m.value
                          ? 'border-[#a855f7] bg-[rgba(168,85,247,0.15)] text-white'
                          : 'border-[#2a2a3e] text-[#888] hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 mb-6">
                  {splits.map((row, index) => (
                    <div key={`${row.method}-${index}`} className="flex gap-2">
                      <select
                        value={row.method}
                        onChange={(e) => setSplits((prev) => prev.map((s, i) => i === index ? { ...s, method: e.target.value } : s))}
                        className="flex-1 px-3 py-2 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white text-sm"
                      >
                        {METHODS.map((m) => (
                          <option key={m.value} value={m.value} disabled={splits.some((s, i) => i !== index && s.method === m.value)}>{m.label}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) => setSplits((prev) => prev.map((s, i) => i === index ? { ...s, amount: e.target.value } : s))}
                        placeholder="Monto"
                        className="w-28 px-3 py-2 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white text-sm"
                      />
                    </div>
                  ))}
                  <p className={`text-xs ${Math.abs(remaining) < 0.02 ? 'text-[#888]' : 'text-[#ef4444]'}`}>
                    {Math.abs(remaining) < 0.02 ? 'Cubierto' : remaining > 0 ? `Falta ${money(remaining)}` : `Sobra ${money(-remaining)}`}
                  </p>
                </div>
              )}

              {usesCash && (
                <div className="mb-6">
                  <input type="number" min="0" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="Recibido en efectivo" className="w-full px-4 py-3 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white text-sm" />
                  {receivedNum > 0 && <p className="text-xs text-[#888] mt-1">Cambio: <strong className="text-white">{money(change)}</strong></p>}
                </div>
              )}

              <div className="flex justify-between text-sm text-[#888] mb-1">
                <span>Subtotal</span><span>{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-[#888] mb-2">
                <span>Descuento{discountPercent ? ` (${discountPercent}%)` : ''}</span><span>{money(discountNum)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-white mb-4">
                <span>Total</span><span>{money(total)}</span>
              </div>
              <button
                disabled={saving || cart.length === 0 || !splitOk}
                onClick={checkout}
                className="w-full py-3 bg-gradient-to-r from-[#a855f7] to-[#6366f1] text-white rounded-lg text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {saving ? 'Cobrando...' : `Cobrar ${money(total)}`}
              </button>
            </div>
          </div>
        )}

        {tab === 'historial' && (
          <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] overflow-hidden">
            {sales.length === 0 ? (
              <p className="p-8 text-[#888] text-center">Aun no hay ventas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#12121e] border-b border-[#2a2a3e]">
                    <tr>
                      <th className="px-5 py-3 text-xs font-semibold text-[#888] uppercase">Fecha</th>
                      <th className="px-5 py-3 text-xs font-semibold text-[#888] uppercase">Cliente</th>
                      <th className="px-5 py-3 text-xs font-semibold text-[#888] uppercase">Detalle</th>
                      <th className="px-5 py-3 text-xs font-semibold text-[#888] uppercase">Pago</th>
                      <th className="px-5 py-3 text-xs font-semibold text-[#888] uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a3e]">
                    {sales.map((sale: any) => (
                      <tr key={sale.id} className={sale.status === 'VOIDED' ? 'opacity-40' : ''}>
                        <td className="px-5 py-3 text-sm">{new Date(sale.createdAt).toLocaleString('es-MX')}</td>
                        <td className="px-5 py-3 text-sm">{sale.customerName || '—'}</td>
                        <td className="px-5 py-3 text-sm text-[#888]">
                          {(sale.items || []).map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}
                        </td>
                        <td className="px-5 py-3 text-sm">{saleMethodLabel(sale)}</td>
                        <td className="px-5 py-3 text-sm font-medium">
                          {money(sale.total)}
                          {sale.status === 'VOIDED' && <span className="block text-[10px] uppercase">Anulada</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDiscountModal(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5 space-y-3"
          >
            <h3 className="text-base font-semibold text-white">Descuento</h3>
            <p className="text-xs text-[#888]">Subtotal {money(subtotal)}{discountPercent ? ` · se descuentan ${money(discountNum)}` : ''}</p>
            <div className="grid grid-cols-2 gap-2">
              {DISCOUNT_PERCENTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setDiscountPercent(p);
                    setShowDiscountModal(false);
                  }}
                  className={`px-4 py-3 rounded-lg border text-sm ${
                    discountPercent === p ? 'border-[#a855f7] bg-[rgba(168,85,247,0.15)] text-white' : 'border-[#2a2a3e] text-[#888]'
                  }`}
                >
                  {p === 0 ? 'Sin descuento' : `${p}%`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCustomerModal(false)}>
          <form
            onSubmit={saveCustomer}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5 space-y-3"
          >
            <h3 className="text-base font-semibold text-white">Registrar cliente</h3>
            <input required value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} placeholder="Nombre *" className="w-full px-4 py-3 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white text-sm" />
            <input value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} placeholder="Teléfono" className="w-full px-4 py-3 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white text-sm" />
            <input type="email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} placeholder="Correo" className="w-full px-4 py-3 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white text-sm" />
            <button type="submit" className="w-full py-3 bg-gradient-to-r from-[#a855f7] to-[#6366f1] text-white rounded-lg text-sm font-bold">
              Guardar y seleccionar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
