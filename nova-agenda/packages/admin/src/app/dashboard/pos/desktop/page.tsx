'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function PosDesktopPage() {
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const slug = user?.client?.slug || '';
  const adminUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function handleDownload() {
    setDownloading(true);
    // For now, show instructions since we need electron-builder output
    setDownloading(false);
  }

  return (
    <div className="space-y-gutter max-w-3xl mx-auto">
      <div>
        <Link href="/dashboard/pos" className="inline-flex items-center gap-1 font-label-sm text-on-surface-variant hover:text-on-surface mb-4">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Volver al panel
        </Link>
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Nova Agenda POS — Escritorio</h2>
        <p className="font-body-md text-on-surface-variant">
          Punto de venta de escritorio para cobrar con impresora de tickets.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-xl">
        <div className="flex items-center gap-4 mb-lg">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#a855f7] to-[#6366f1] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-3xl text-white">point_of_sale</span>
          </div>
          <div>
            <h3 className="font-headline-md text-on-surface">Nova Agenda POS</h3>
            <p className="font-body-sm text-on-surface-variant">v1.0.0 · Windows (.exe)</p>
          </div>
        </div>

        <div className="space-y-md mb-xl">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#2dd4bf] mt-0.5">check_circle</span>
            <div>
              <p className="font-label-md text-on-surface">Caja rapida con impresion de tickets</p>
              <p className="font-body-sm text-on-surface-variant">Soporta impresoras termicas XPrinter de 58mm y 80mm</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#2dd4bf] mt-0.5">check_circle</span>
            <div>
              <p className="font-label-md text-on-surface">Cobro en efectivo, tarjeta o transferencia</p>
              <p className="font-body-sm text-on-surface-variant">Calculo automatico de cambio</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#2dd4bf] mt-0.5">check_circle</span>
            <div>
              <p className="font-label-md text-on-surface">Historial de ventas del dia</p>
              <p className="font-body-sm text-on-surface-variant">Consulta todas las ventas realizadas en la terminal</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#2dd4bf] mt-0.5">check_circle</span>
            <div>
              <p className="font-label-md text-on-surface">Productos y servicios del negocio</p>
              <p className="font-body-sm text-on-surface-variant">Se sincroniza automaticamente con tu panel de administracion</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-xl p-lg mb-lg">
          <h4 className="font-label-md text-on-surface mb-3">Configuracion de instalacion</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-on-surface-variant w-40">Direccion del admin:</span>
              <code className="font-body-sm bg-surface-bright px-3 py-1 rounded-lg text-on-surface">{adminUrl || '...'}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-on-surface-variant w-40">Slug de tu negocio:</span>
              <code className="font-body-sm bg-surface-bright px-3 py-1 rounded-lg text-on-surface font-bold">{slug || '...'}</code>
            </div>
          </div>
          <p className="font-body-xs text-on-surface-variant mt-3">
            Estos datos se ingresa automaticamente en el asistente de configuracion del POS.
          </p>
        </div>

        <div className="bg-surface-container-low rounded-xl p-lg mb-lg">
          <h4 className="font-label-md text-on-surface mb-3">Requisitos</h4>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-base text-on-surface">desktop_windows</span>
              Windows 10 o superior (64-bit)
            </li>
            <li className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-base text-on-surface">print</span>
              Impresora termica XPrinter (58mm o 80mm) — opcional
            </li>
            <li className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-base text-on-surface">wifi</span>
              Conexion a internet
            </li>
          </ul>
        </div>

        <button
          disabled={downloading}
          onClick={handleDownload}
          className="w-full py-3 bg-gradient-to-r from-[#a855f7] to-[#6366f1] text-white rounded-lg font-label-md font-bold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">download</span>
          Descargar Nova Agenda POS (Windows)
        </button>

        <p className="font-body-xs text-on-surface-variant text-center mt-3">
          El instalador configurara automaticamente la conexion con tu negocio.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-xl">
        <h3 className="font-headline-md text-on-surface mb-md">Configurar impresora</h3>
        <div className="space-y-md">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0">
              <span className="font-label-sm text-on-primary-container font-bold">1</span>
            </div>
            <div>
              <p className="font-label-md text-on-surface">Instala los drivers de XPrinter</p>
              <p className="font-body-sm text-on-surface-variant">
                Descarga desde{' '}
                <a href="https://www.xprintertech.com/downloads" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  xprintertech.com/downloads
                </a>
                {' '}e instala el driver para Windows.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0">
              <span className="font-label-sm text-on-primary-container font-bold">2</span>
            </div>
            <div>
              <p className="font-label-md text-on-surface">Conecta la impresora por USB</p>
              <p className="font-body-sm text-on-surface-variant">
                Windows la detectara automaticamente. Asegurate de que este encendida.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0">
              <span className="font-label-sm text-on-primary-container font-bold">3</span>
            </div>
            <div>
              <p className="font-label-md text-on-surface">Configura en el asistente del POS</p>
              <p className="font-body-sm text-on-surface-variant">
                Al abrir Nova Agenda POS por primera vez, selecciona tu impresora y haz prueba de impresion.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
