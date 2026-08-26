'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PosRegister from '@/components/PosRegister';

function CajaInner() {
  const params = useSearchParams();
  const popup = params.get('popup') === '1';

  return (
    <div className="space-y-gutter">
      <div className="flex items-center justify-between gap-3">
        <div>
          {!popup && (
            <Link href="/dashboard/pos" className="inline-flex items-center gap-1 font-label-sm text-on-surface-variant hover:text-on-surface mb-2">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Volver al panel
            </Link>
          )}
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Caja</h2>
          <p className="font-body-md text-on-surface-variant">Cobra servicios, productos o un monto libre.</p>
        </div>
        {popup && (
          <button
            type="button"
            onClick={() => window.close()}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-outline-variant font-label-sm hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-lg">close</span>
            Cerrar
          </button>
        )}
      </div>
      <PosRegister compact={popup} />
    </div>
  );
}

export default function PosCajaPage() {
  return (
    <Suspense fallback={<div className="glass-card rounded-xl h-96 animate-pulse" />}>
      <CajaInner />
    </Suspense>
  );
}
