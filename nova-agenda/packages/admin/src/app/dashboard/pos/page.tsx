'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, PosProduct, PosSale, PosSummary } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { hasAddon } from '@/lib/addons';
import { money, saleMethodLabel } from '@/lib/pos-format';

type Tab = 'historial' | 'productos' | 'clientes';

const CAJA_FEATURES = 'popup=yes,width=1280,height=860,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes';

function openCajaPopup() {
  const w = 1280;
  const h = 860;
  const left = Math.max(0, Math.round((window.screen.width - w) / 2));
  const top = Math.max(0, Math.round((window.screen.height - h) / 2));
  const popup = window.open(
    '/dashboard/pos/caja?popup=1',
    'nova-pos-caja',
    `${CAJA_FEATURES},left=${left},top=${top}`
  );
  if (!popup) {
    window.location.href = '/dashboard/pos/caja';
  } else {
    popup.focus();
  }
}

export default function PosPage() {
  const { user } = useAuth();
  const [addons, setAddons] = useState<string[]>(user?.client?.addons || []);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('historial');
  const [allProducts, setAllProducts] = useState<PosProduct[]>([]);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [summary, setSummary] = useState<PosSummary | null>(null);
  const [message, setMessage] = useState('');
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
    const [productList, saleList, day] = await Promise.all([
      api.getPosProducts(),
      api.getPosSales(),
      api.getPosSummary(),
    ]);
    setAllProducts(productList);
    setSales(saleList);
    setSummary(day);
  }

  const completedSales = useMemo(() => sales.filter((s) => s.status !== 'VOIDED'), [sales]);
  const uniqueClients = useMemo(() => {
    const keys = new Set(
      completedSales
        .map((s) => s.customerPhone || s.customerName)
        .filter(Boolean)
    );
    return keys.size;
  }, [completedSales]);
  const avgTicket = summary && summary.todayCount > 0 ? summary.todayTotal / summary.todayCount : 0;
  const activeProducts = allProducts.filter((p) => p.isActive).length;

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
          {[1, 2, 3, 4].map((i) => <div key={i} className="glass-card rounded-xl h-28" />)}
        </div>
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

  const kpis = [
    { label: 'Ventas de hoy', value: money(summary?.todayTotal || 0), icon: 'payments', hint: 'Ingresos del día' },
    { label: 'Tickets hoy', value: String(summary?.todayCount || 0), icon: 'receipt_long', hint: 'Cobros completados' },
    { label: 'Ticket promedio', value: money(avgTicket), icon: 'analytics', hint: 'Promedio por venta' },
    { label: 'Productos activos', value: String(activeProducts), icon: 'inventory_2', hint: 'Catálogo de caja' },
  ];

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Punto de venta</h2>
          <p className="font-body-md text-on-surface-variant">Resumen, historial y catálogo. La caja se abre en otra ventana.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={openCajaPopup}
            className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:opacity-90"
          >
            <span className="material-symbols-outlined">open_in_new</span>
            Abrir caja
          </button>
          <a
            href="/dashboard/pos/desktop"
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-lg font-label-sm text-on-surface hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            App escritorio
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-gutter">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary-container/40 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">{kpi.icon}</span>
              </div>
              <span className="font-label-sm text-on-surface-variant">{kpi.hint}</span>
            </div>
            <p className="font-label-md text-on-surface-variant">{kpi.label}</p>
            <p className="font-headline-lg text-on-surface mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-gutter">
          {([
            ['CASH', 'Efectivo', 'payments'],
            ['CARD', 'Tarjeta', 'credit_card'],
            ['TRANSFER', 'Transferencia', 'account_balance'],
          ] as const).map(([key, label, icon]) => (
            <div key={key} className="bg-surface-container-low rounded-xl p-lg flex items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant">{icon}</span>
              <div>
                <p className="font-label-sm text-on-surface-variant">{label} hoy</p>
                <p className="font-headline-md text-on-surface">{money(summary.byMethod?.[key] || 0)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <button type="button" onClick={() => setTab('historial')} className="text-left bg-surface-container-lowest rounded-xl border border-outline-variant p-lg hover:border-primary transition-all">
          <span className="material-symbols-outlined text-primary mb-2">history</span>
          <p className="font-headline-md text-on-surface">Historial</p>
          <p className="font-body-sm text-on-surface-variant">{completedSales.length} ventas recientes · {uniqueClients} clientes</p>
        </button>
        <button type="button" onClick={() => setTab('productos')} className="text-left bg-surface-container-lowest rounded-xl border border-outline-variant p-lg hover:border-primary transition-all">
          <span className="material-symbols-outlined text-primary mb-2">inventory_2</span>
          <p className="font-headline-md text-on-surface">Productos</p>
          <p className="font-body-sm text-on-surface-variant">{activeProducts} activos en catálogo</p>
        </button>
        <button type="button" onClick={() => setTab('clientes')} className="text-left bg-surface-container-lowest rounded-xl border border-outline-variant p-lg hover:border-primary transition-all">
          <span className="material-symbols-outlined text-primary mb-2">group</span>
          <p className="font-headline-md text-on-surface">Clientes</p>
          <p className="font-body-sm text-on-surface-variant">Quienes compraron en caja</p>
        </button>
      </div>

      {message && <div className="p-4 bg-error-container text-on-error-container rounded-lg">{message}</div>}

      <div className="flex gap-2 bg-surface-container-low rounded-lg p-1 w-fit">
        {([
          ['historial', 'Historial'],
          ['productos', 'Productos'],
          ['clientes', 'Clientes'],
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

      {tab === 'historial' && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
          {sales.length === 0 ? (
            <p className="p-xl text-on-surface-variant">Aún no hay ventas. Abre la caja para registrar el primer cobro.</p>
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
                      <td className="px-lg py-3 font-body-sm">{saleMethodLabel(sale)}</td>
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
                Crea productos de mostrador (bebidas, calcetines, etc.) para venderlos en caja.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'clientes' && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
          {sales.length === 0 ? (
            <p className="p-xl text-on-surface-variant">Aún no hay ventas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase">Cliente</th>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase">Teléfono</th>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase">Visitas</th>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase">Total gastado</th>
                    <th className="px-lg py-3 font-label-sm text-on-surface-variant uppercase">Última compra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {(() => {
                    const clientMap = new Map<string, { name: string; phone: string; visits: number; totalSpent: number; lastDate: string }>();
                    for (const sale of sales) {
                      if (sale.status === 'VOIDED') continue;
                      const key = sale.customerPhone || sale.customerName || '__anonymous__';
                      if (key === '__anonymous__') continue;
                      const existing = clientMap.get(key);
                      if (existing) {
                        existing.visits++;
                        existing.totalSpent += sale.total;
                        if (sale.createdAt > existing.lastDate) existing.lastDate = sale.createdAt;
                        if (sale.customerName && !existing.name) existing.name = sale.customerName;
                      } else {
                        clientMap.set(key, {
                          name: sale.customerName || 'Sin nombre',
                          phone: sale.customerPhone || '',
                          visits: 1,
                          totalSpent: sale.total,
                          lastDate: sale.createdAt,
                        });
                      }
                    }
                    const clients = Array.from(clientMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
                    if (clients.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="px-lg py-xl text-on-surface-variant text-center">No hay clientes registrados en las ventas.</td>
                        </tr>
                      );
                    }
                    return clients.map((c, i) => (
                      <tr key={i} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-lg py-3 font-label-md">{c.name}</td>
                        <td className="px-lg py-3 font-body-sm text-on-surface-variant">{c.phone || '—'}</td>
                        <td className="px-lg py-3 font-body-sm">{c.visits}</td>
                        <td className="px-lg py-3 font-label-md">{money(c.totalSpent)}</td>
                        <td className="px-lg py-3 font-body-sm text-on-surface-variant">{new Date(c.lastDate).toLocaleDateString('es-MX')}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
