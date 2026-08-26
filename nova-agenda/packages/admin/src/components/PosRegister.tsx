'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  api,
  PosCatalogService,
  PosProduct,
  PosSale,
} from '@/lib/api';
import { POS_METHODS, money, methodLabel } from '@/lib/pos-format';

type CartLine = {
  key: string;
  kind: 'SERVICE' | 'PRODUCT' | 'CUSTOM';
  name: string;
  unitPrice: number;
  quantity: number;
  serviceId?: string;
  productId?: string;
};

export default function PosRegister({ compact = false, onSale }: { compact?: boolean; onSale?: () => void }) {
  const [services, setServices] = useState<PosCatalogService[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
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

  useEffect(() => {
    api.getPosCatalog().then((catalog) => {
      setServices(catalog.services);
      setProducts(catalog.products);
    }).catch((error) => {
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar el catálogo');
    });
  }, []);

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
              {methodLabel(lastSale.paymentMethod)}
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
    </div>
  );
}
