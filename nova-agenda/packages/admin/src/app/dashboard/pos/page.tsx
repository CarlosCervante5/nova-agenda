'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  api,
  PosCatalogService,
  PosProduct,
  PosSale,
  PosSummary,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { hasAddon } from '@/lib/addons';

type Tab = 'caja' | 'historial' | 'productos';
type CartLine = {
  key: string;
  kind: 'SERVICE' | 'PRODUCT' | 'CUSTOM';
  name: string;
  unitPrice: number;
  quantity: number;
  serviceId?: string;
  productId?: string;
};

const METHODS = [
  { value: 'CASH', label: 'Efectivo', icon: 'payments' },
  { value: 'CARD', label: 'Tarjeta', icon: 'credit_card' },
  { value: 'TRANSFER', label: 'Transferencia', icon: 'account_balance' },
];

function money(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}

function methodLabel(value: string) {
  return METHODS.find((m) => m.value === value)?.label || value;
}

export default function PosPage() {
  const { user } = useAuth();
  const [addons, setAddons] = useState<string[]>(user?.client?.addons || []);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('caja');
  const [services, setServices] = useState<PosCatalogService[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [allProducts, setAllProducts] = useState<PosProduct[]>([]);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [summary, setSummary] = useState<PosSummary | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState('CASH');
  const [received, setReceived] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [lastSale, setLastSale] = useState<PosSale | null>(null);
  const [productForm, setProductForm] = useState({ name: '', price: '', sku: '', description: '' });

  useEffect(() => {
    if (!user?.clientId) {
      setLoading(false);
      return;
    }
    api.getClient(user.clientId)
      .then((c) => {
        const list = c.addons || [];
        setAddons(list);
        if (hasAddon(list, 'POS')) return loadPos();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.clientId]);

  async function loadPos() {
    const [catalog, productList, saleList, day] = await Promise.all([
      api.getPosCatalog(),
      api.getPosProducts(),
      api.getPosSales(),
      api.getPosSummary(),
    ]);
    setServices(catalog.services);
    setProducts(catalog.products);
    setAllProducts(productList);
    setSales(saleList);
    setSummary(day);
  }

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
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

  async function checkout() {
    if (cart.length === 0) return;
    setSaving(true);
    setMessage('');
    try {
      const sale = await api.createPosSale({
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        discount: discountNum,
        paymentMethod: method,
        notes: notes.trim() || undefined,
        receivedAmount: method === 'CASH' && receivedNum > 0 ? receivedNum : undefined,
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
      setCustomerName('');
      setCustomerPhone('');
      setDiscount('0');
      setNotes('');
      setReceived('');
      await loadPos();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cobrar');
    } finally {
      setSaving(false);
    }
  }

  async function voidSale(id: string) {
    if (!confirm('¿Anular esta venta? No se borra, queda marcada como anulada.')) return;
    try {
      await api.voidPosSale(id);
      await loadPos();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo anular');
    }
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createPosProduct({
        name: productForm.name,
        price: Number(productForm.price) || 0,
        sku: productForm.sku || undefined,
        description: productForm.description || undefined,
      });
      setProductForm({ name: '', price: '', sku: '', description: '' });
      await loadPos();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar el producto');
    }
  }

  if (loading) {
    return (
      <div className="space-y-gutter animate-pulse">
        <div className="glass-card rounded-xl h-12" />
        <div className="glass-card rounded-xl h-96" />
      </div>
    );
  }

  if (!hasAddon(addons, 'POS')) {
    return (
      <div className="space-y-gutter">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Punto de venta</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Cobra en caja y registra ventas del negocio</p>
        </div>
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm text-center py-16">
          <div className="w-16 h-16 bg-tertiary-container rounded-full flex items-center justify-center mx-auto mb-lg">
            <span className="material-symbols-outlined text-3xl text-on-tertiary-container">point_of_sale</span>
          </div>
          <h3 className="font-headline-md text-on-surface mb-sm">Addon: Punto de venta</h3>
          <p className="font-body-md text-on-surface-variant mb-lg max-w-md mx-auto">
            Es un addon de <strong>$199/mes</strong>. Permite caja, cobros y registro de ventas.
          </p>
          <Link href="/dashboard/billing" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold">
            Contratar en Facturación
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Punto de venta</h2>
          <p className="font-body-md text-on-surface-variant">Cobra servicios, productos o un monto libre.</p>
        </div>
        {summary && (
          <div className="flex gap-2 flex-wrap">
            <div className="px-4 py-2 rounded-lg bg-surface-container-low">
              <p className="font-label-sm text-on-surface-variant">Hoy</p>
              <p className="font-headline-md text-on-surface">{money(summary.todayTotal)}</p>
            </div>
            <div className="px-4 py-2 rounded-lg bg-surface-container-low">
              <p className="font-label-sm text-on-surface-variant">Ventas</p>
              <p className="font-headline-md text-on-surface">{summary.todayCount}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 bg-surface-container-low rounded-lg p-1 w-fit">
        {([
          ['caja', 'Caja'],
          ['historial', 'Historial'],
          ['productos', 'Productos'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-md font-label-md ${tab === id ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <div className="p-4 bg-error-container text-on-error-container rounded-lg">{message}</div>}

      {lastSale && tab === 'caja' && (
        <div className="p-4 rounded-xl border border-secondary-container bg-secondary-container/20 flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-on-surface">Venta cobrada · {money(lastSale.total)}</p>
            <p className="font-body-sm text-on-surface-variant">
              {methodLabel(lastSale.paymentMethod)}
              {lastSale.receivedAmount ? ` · Recibido ${money(lastSale.receivedAmount)}` : ''}
            </p>
          </div>
          <button onClick={() => setLastSale(null)} className="font-label-sm text-on-surface-variant">Cerrar</button>
        </div>
      )}

      {tab === 'caja' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-gutter">
          <div className="space-y-md">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar servicio o producto…"
              className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg outline-none focus:border-primary"
            />
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg">
              <h3 className="font-headline-md text-on-surface mb-md">Servicios</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredServices.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => addLine({ kind: 'SERVICE', name: s.name, unitPrice: s.price || 0, serviceId: s.id })}
                    className="text-left p-3 rounded-lg border border-outline-variant hover:border-primary transition-all"
                  >
                    <p className="font-label-md text-on-surface">{s.name}</p>
                    <p className="font-body-sm text-on-surface-variant">{s.duration} min · {money(s.price || 0)}</p>
                  </button>
                ))}
                {filteredServices.length === 0 && <p className="font-body-sm text-on-surface-variant col-span-full">No hay servicios activos.</p>}
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg">
              <h3 className="font-headline-md text-on-surface mb-md">Productos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addLine({ kind: 'PRODUCT', name: p.name, unitPrice: p.price, productId: p.id })}
                    className="text-left p-3 rounded-lg border border-outline-variant hover:border-primary transition-all"
                  >
                    <p className="font-label-md text-on-surface">{p.name}</p>
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
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Cliente (opcional)" className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg" />
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Teléfono (opcional)" className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg" />
              <div>
                <label className="font-label-sm text-on-surface-variant mb-1 block">Descuento</label>
                <input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg" />
              </div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg min-h-[64px]" />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-lg">
              {METHODS.map((m) => (
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

            {method === 'CASH' && (
              <div className="mb-lg">
                <label className="font-label-sm text-on-surface-variant mb-1 block">Recibido</label>
                <input type="number" min="0" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg" />
                {receivedNum > 0 && <p className="font-body-sm mt-1">Cambio: <strong>{money(change)}</strong></p>}
              </div>
            )}

            <div className="flex justify-between font-body-sm text-on-surface-variant mb-1">
              <span>Subtotal</span><span>{money(subtotal)}</span>
            </div>
            <div className="flex justify-between font-body-sm text-on-surface-variant mb-3">
              <span>Descuento</span><span>{money(discountNum)}</span>
            </div>
            <div className="flex justify-between font-headline-md text-on-surface mb-lg">
              <span>Total</span><span>{money(total)}</span>
            </div>
            <button
              disabled={saving || cart.length === 0}
              onClick={checkout}
              className="w-full py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold disabled:opacity-50"
            >
              {saving ? 'Cobrando…' : `Cobrar ${money(total)}`}
            </button>
          </div>
        </div>
      )}

      {tab === 'historial' && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
          {sales.length === 0 ? (
            <p className="p-xl text-on-surface-variant">Aún no hay ventas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase">Fecha</th>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase">Cliente</th>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase">Detalle</th>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase">Pago</th>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase">Total</th>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {sales.map((sale) => (
                    <tr key={sale.id} className={sale.status === 'VOIDED' ? 'opacity-50' : ''}>
                      <td className="px-lg py-3 font-body-sm">{new Date(sale.createdAt).toLocaleString('es-MX')}</td>
                      <td className="px-lg py-3 font-body-sm">{sale.customerName || '—'}</td>
                      <td className="px-lg py-3 font-body-sm text-on-surface-variant">
                        {sale.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                      </td>
                      <td className="px-lg py-3 font-body-sm">{methodLabel(sale.paymentMethod)}</td>
                      <td className="px-lg py-3 font-label-md">
                        {money(sale.total)}
                        {sale.status === 'VOIDED' && <span className="block text-[10px] uppercase">Anulada</span>}
                      </td>
                      <td className="px-lg py-3 text-right">
                        {sale.status !== 'VOIDED' && (
                          <button onClick={() => voidSale(sale.id)} className="font-label-sm text-error">Anular</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'productos' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-gutter">
          <form onSubmit={saveProduct} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg space-y-md">
            <h3 className="font-headline-md text-on-surface">Nuevo producto</h3>
            <input required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Nombre" className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg" />
            <input required type="number" min="0" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} placeholder="Precio" className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg" />
            <input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} placeholder="SKU (opcional)" className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg" />
            <textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="Descripción" className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg" />
            <button type="submit" className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold">Guardar producto</button>
          </form>
          <div className="space-y-2">
            {allProducts.map((p) => (
              <div key={p.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg flex items-center justify-between gap-3">
                <div>
                  <p className="font-label-md text-on-surface">{p.name}</p>
                  <p className="font-body-sm text-on-surface-variant">{money(p.price)}{p.sku ? ` · ${p.sku}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => api.updatePosProduct(p.id, { isActive: !p.isActive }).then(loadPos)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${p.isActive ? 'bg-secondary-container/30' : 'bg-surface-container-high'}`}
                  >
                    {p.isActive ? 'Activo' : 'Oculto'}
                  </button>
                  {p.isActive && (
                    <button onClick={() => api.deletePosProduct(p.id).then(loadPos)} className="text-error font-label-sm">Quitar</button>
                  )}
                </div>
              </div>
            ))}
            {allProducts.length === 0 && (
              <p className="p-xl bg-surface-container-lowest rounded-xl border border-outline-variant text-on-surface-variant">
                Crea productos de mostrador (shampoo, kit, etc.) para venderlos en caja.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
