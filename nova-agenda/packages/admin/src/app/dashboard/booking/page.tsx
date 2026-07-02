'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Client, Service } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getBookingFormUrl, getClientPortalBaseUrl } from '@/lib/booking-url';

export default function BookingSharePage() {
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null);

  useEffect(() => {
    if (user?.clientId) loadData();
    else setLoading(false);
  }, [user]);

  async function loadData() {
    try {
      const [clientData, servicesData] = await Promise.all([
        api.getClient(user!.clientId!),
        api.getServices(),
      ]);
      setClient(clientData);
      setServices(servicesData.filter((s) => s.isActive));
    } catch (error) {
      console.error('Error loading booking page data:', error);
    } finally {
      setLoading(false);
    }
  }

  const portalBase = getClientPortalBaseUrl();
  const bookingUrl = client?.slug ? getBookingFormUrl(client.slug) : '';
  const portalConfigured = portalBase.startsWith('http');
  const embedCode = bookingUrl
    ? `<iframe src="${bookingUrl}" width="100%" height="720" style="border:0;border-radius:16px;" title="Reservar cita"></iframe>`
    : '';

  async function copyText(text: string, kind: 'link' | 'embed') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      alert('No se pudo copiar. Selecciona el texto manualmente.');
    }
  }

  if (loading) {
    return <div className="glass-card rounded-xl h-64 animate-pulse" />;
  }

  if (!user?.clientId) {
    return (
      <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant text-center">
        <p className="font-body-md text-on-surface-variant">Inicia sesión con una cuenta de negocio para compartir tu agenda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-gutter">
      <div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Formulario de Agenda</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Crea servicios y comparte el enlace para que tus clientes reserven en línea. Disponible en el plan Gratuito.
        </p>
      </div>

      <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
        <div className="flex items-start gap-4 mb-lg">
          <div className="w-12 h-12 bg-primary-container rounded-xl flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">link</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-headline-md text-on-surface mb-1">Enlace público de reservas</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">
              Compártelo por WhatsApp, redes sociales o tu sitio web.
            </p>
            {bookingUrl && portalConfigured ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  readOnly
                  value={bookingUrl}
                  className="flex-1 px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-sm text-body-sm truncate"
                />
                <button
                  onClick={() => copyText(bookingUrl, 'link')}
                  className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold hover:opacity-90 transition-all whitespace-nowrap"
                >
                  {copied === 'link' ? '¡Copiado!' : 'Copiar enlace'}
                </button>
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-lg py-3 border border-outline-variant text-on-surface rounded-lg font-label-md text-label-md font-bold text-center hover:bg-surface-container-low transition-all whitespace-nowrap"
                >
                  Abrir
                </a>
              </div>
            ) : bookingUrl ? (
              <div className="p-md rounded-lg bg-tertiary-container/30 border border-outline-variant">
                <p className="font-body-sm text-on-surface-variant">
                  Configura <code className="text-xs">NEXT_PUBLIC_CLIENT_PORTAL_URL</code> en el servicio admin con la URL de client-sites (ej. delightful-encouragement…).
                </p>
                <p className="font-body-sm text-on-surface mt-2">
                  Slug de tu negocio: <strong>{client?.slug}</strong> → ruta <code className="text-xs">/{client?.slug}</code>
                </p>
              </div>
            ) : (
              <p className="font-body-sm text-error">No se pudo generar el enlace. Verifica el slug de tu negocio.</p>
            )}
          </div>
        </div>

        {embedCode && portalConfigured && (
          <div className="pt-lg border-t border-outline-variant">
            <h4 className="font-label-md text-label-md text-on-surface mb-sm">Insertar en tu web (iframe)</h4>
            <textarea
              readOnly
              value={embedCode}
              rows={3}
              className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-sm text-body-sm mb-2"
            />
            <button
              onClick={() => copyText(embedCode, 'embed')}
              className="px-md py-2 border border-outline-variant rounded-lg font-label-sm text-label-sm hover:bg-surface-container-low transition-all"
            >
              {copied === 'embed' ? '¡Copiado!' : 'Copiar código embed'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant">
          <h3 className="font-headline-md text-on-surface mb-md flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">inventory_2</span>
            Servicios en tu formulario ({services.length})
          </h3>
          {services.length === 0 ? (
            <div className="text-center py-md">
              <p className="font-body-sm text-on-surface-variant mb-md">
                Agrega al menos un servicio para que aparezca en el formulario de reservas.
              </p>
              <Link
                href="/dashboard/services"
                className="inline-flex items-center gap-2 px-lg py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold hover:opacity-90 transition-all"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Crear servicio
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {services.map((service) => (
                <li
                  key={service.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-outline-variant"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: service.color }} />
                    <span className="font-medium text-on-surface text-sm">{service.name}</span>
                  </div>
                  <span className="text-xs text-on-surface-variant">{service.duration} min</span>
                </li>
              ))}
            </ul>
          )}
          {services.length > 0 && (
            <Link
              href="/dashboard/services"
              className="inline-block mt-md font-label-sm text-label-sm text-primary font-bold hover:underline"
            >
              Gestionar servicios →
            </Link>
          )}
        </div>

        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant">
          <h3 className="font-headline-md text-on-surface mb-md flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">help</span>
            Cómo funciona
          </h3>
          <ol className="space-y-3 font-body-sm text-body-sm text-on-surface-variant list-decimal list-inside">
            <li>Crea tus servicios (nombre, duración, precio).</li>
            <li>Copia y comparte el enlace público de arriba.</li>
            <li>Tus clientes eligen servicio, fecha y hora.</li>
            <li>Las citas aparecen en tu panel principal.</li>
          </ol>
          <div className="mt-lg p-md rounded-lg bg-primary-fixed/30 border border-primary-container/30">
            <p className="font-label-sm text-label-sm text-on-primary-fixed-variant">
              Plan Gratuito: hasta 3 servicios y 50 citas/mes. El formulario de agenda está incluido.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
