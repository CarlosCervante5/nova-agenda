'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { hasAddon } from '@/lib/addons';

export default function PosPage() {
  const { user } = useAuth();
  const [addons, setAddons] = useState<string[]>(user?.client?.addons || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.clientId) {
      setLoading(false);
      return;
    }
    api.getClient(user.clientId)
      .then((c) => setAddons(c.addons || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.clientId]);

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
          <p className="font-body-md text-body-md text-on-surface-variant">
            Cobra en caja y registra ventas del negocio
          </p>
        </div>
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm text-center py-16">
          <div className="w-16 h-16 bg-tertiary-container rounded-full flex items-center justify-center mx-auto mb-lg">
            <span className="material-symbols-outlined text-3xl text-on-tertiary-container">point_of_sale</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">Addon: Punto de venta</h3>
          <p className="font-body-md text-body-md text-on-surface-variant mb-lg max-w-md mx-auto">
            Es un addon de <strong>$199/mes</strong> aparte del plan. Permite caja, cobros y registro de ventas
            desde el panel.
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold shadow-md shadow-primary/20 hover:opacity-90"
          >
            <span className="material-symbols-outlined">payments</span>
            Contratar en Facturación
          </Link>
          <p className="font-body-sm text-on-surface-variant mt-lg">
            También lo puede activar el super admin en Negocios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-surface-container-high rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-primary text-4xl">point_of_sale</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Punto de Venta</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant mb-4">
          Addon activo. Estamos dejando lista la caja para ventas, cobros y pagos de tu negocio.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full font-label-md">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          Contratado · $199/mes
        </div>
      </div>
    </div>
  );
}
