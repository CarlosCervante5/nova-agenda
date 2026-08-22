'use client';

import { useEffect, useMemo, useState } from 'react';
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

const METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
];

function money(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}
function methodLabel(v: string) {
  return METHODS.find((m) => m.value === v)?.label || v;
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
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState('0');
  const [method, setMethod] = useState('CASH');
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
      const [cat, prod, saleList] = await Promise.all([
        fetch(`/api/pos/catalog?clientId=${cid}`).then((r) => r.json()),
        fetch(`/api/pos/products?clientId=${cid}`).then((r) => r.json()),
        fetch(`/api/pos/sales?clientId=${cid}`).then((r) => r.json()),
      ]);
      setServices(cat.services || []);
      setProducts(cat.products || []);
      setSales(saleList || []);
    } catch {
      setMessage('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const discountNum = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const total = Math.max(0, subtotal - discountNum);
  const receivedNum = Number(received) || 0;
  const change = method === 'CASH' && receivedNum > 0 ? Math.max(0, receivedNum - total) : 0;

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
    if (cart.length === 0 || !clientId) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/pos/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          discount: discountNum,
          paymentMethod: method,
          receivedAmount: method === 'CASH' && receivedNum > 0 ? receivedNum : undefined,
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
      setCustomerName('');
      setCustomerPhone('');
      setDiscount('0');
      setReceived('');
      await loadData(clientId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error al cobrar');
    } finally {
      setSaving(false);
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredServices.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => addLine({ kind: 'SERVICE', name: s.name, unitPrice: s.price || 0, serviceId: s.id })}
                      className="text-left p-3 rounded-lg border border-[#2a2a3e] hover:border-[#a855f7] transition-all"
                    >
                      <p className="text-sm font-medium text-white">{s.name}</p>
                      <p className="text-xs text-[#888]">{s.duration} min · {money(s.price || 0)}</p>
                    </button>
                  ))}
                  {filteredServices.length === 0 && <p className="text-xs text-[#888] col-span-full">No hay servicios activos.</p>}
                </div>
              </div>
              <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-5">
                <h3 className="text-base font-semibold text-white mb-3">Productos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addLine({ kind: 'PRODUCT', name: p.name, unitPrice: p.price, productId: p.id })}
                      className="text-left p-3 rounded-lg border border-[#2a2a3e] hover:border-[#a855f7] transition-all"
                    >
                      <p className="text-sm font-medium text-white">{p.name}</p>
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
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Cliente (opcional)" className="w-full px-4 py-3 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white text-sm" />
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Telefono (opcional)" className="w-full px-4 py-3 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white text-sm" />
                <input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Descuento" className="w-full px-4 py-3 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white text-sm" />
              </div>

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

              {method === 'CASH' && (
                <div className="mb-6">
                  <input type="number" min="0" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="Recibido" className="w-full px-4 py-3 bg-[#12121e] border border-[#2a2a3e] rounded-lg text-white text-sm" />
                  {receivedNum > 0 && <p className="text-xs text-[#888] mt-1">Cambio: <strong className="text-white">{money(change)}</strong></p>}
                </div>
              )}

              <div className="flex justify-between text-sm text-[#888] mb-1">
                <span>Subtotal</span><span>{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-[#888] mb-2">
                <span>Descuento</span><span>{money(discountNum)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-white mb-4">
                <span>Total</span><span>{money(total)}</span>
              </div>
              <button
                disabled={saving || cart.length === 0}
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
                        <td className="px-5 py-3 text-sm">{methodLabel(sale.paymentMethod)}</td>
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
    </div>
  );
}
