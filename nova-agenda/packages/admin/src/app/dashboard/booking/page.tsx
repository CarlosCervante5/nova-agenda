'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Client, Service } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getBookingFormUrl, getClientPortalBaseUrl } from '@/lib/booking-url';

const SLOT_GAP_OPTIONS = [5, 10, 15, 20] as const;

type FormConfig = {
  bookingFormEnabled: boolean;
  bookingRequirePhone: boolean;
  bookingRequireEmail: boolean;
  bookingShowNotes: boolean;
  bookingIntroText: string;
  bookingSuccessText: string;
  bookingConfirmAuto: boolean;
  slotGapMinutes: number;
};

function clientToConfig(client: Client): FormConfig {
  return {
    bookingFormEnabled: client.bookingFormEnabled !== false,
    bookingRequirePhone: !!client.bookingRequirePhone,
    bookingRequireEmail: !!client.bookingRequireEmail,
    bookingShowNotes: client.bookingShowNotes !== false,
    bookingIntroText: client.bookingIntroText || '',
    bookingSuccessText: client.bookingSuccessText || '',
    bookingConfirmAuto: !!client.bookingConfirmAuto,
    slotGapMinutes: SLOT_GAP_OPTIONS.includes(client.slotGapMinutes as (typeof SLOT_GAP_OPTIONS)[number])
      ? (client.slotGapMinutes as number)
      : 10,
  };
}

export default function BookingSharePage() {
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null);
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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
      setConfig(clientToConfig(clientData));
      setServices(servicesData.filter((s) => s.isActive));
    } catch (error) {
      console.error('Error loading booking page data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.clientId || !config) return;
    setSaving(true);
    setMessage('');
    try {
      const updated = await api.updateClient(user.clientId, {
        bookingFormEnabled: config.bookingFormEnabled,
        bookingRequirePhone: config.bookingRequirePhone,
        bookingRequireEmail: config.bookingRequireEmail,
        bookingShowNotes: config.bookingShowNotes,
        bookingIntroText: config.bookingIntroText.trim() || null,
        bookingSuccessText: config.bookingSuccessText.trim() || null,
        bookingConfirmAuto: config.bookingConfirmAuto,
        slotGapMinutes: config.slotGapMinutes,
      });
      setClient(updated);
      setConfig(clientToConfig(updated));
      setMessage('Configuración del formulario guardada');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: unknown) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'No se pudo guardar'));
    } finally {
      setSaving(false);
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
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Agenda pública</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Configura y comparte el formulario para que tus clientes reserven en línea.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            message.startsWith('Error')
              ? 'bg-error-container text-on-error-container'
              : 'bg-secondary-container text-on-secondary-container'
          }`}
        >
          <span className="material-symbols-outlined">
            {message.startsWith('Error') ? 'error' : 'check_circle'}
          </span>
          <p className="font-body-sm">{message}</p>
        </div>
      )}

      {/* Enlace */}
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
                  Configura <code className="text-xs">NEXT_PUBLIC_CLIENT_PORTAL_URL</code> en el servicio admin.
                </p>
                <p className="font-body-sm text-on-surface mt-2">
                  Slug: <strong>{client?.slug}</strong> → <code className="text-xs">/{client?.slug}</code>
                </p>
              </div>
            ) : (
              <p className="font-body-sm text-error">No se pudo generar el enlace.</p>
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

      {/* Configuración del formulario */}
      {config && (
        <form
          onSubmit={saveConfig}
          className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm space-y-lg"
        >
          <div>
            <h3 className="font-headline-md text-on-surface flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary">tune</span>
              Configuración del formulario público
            </h3>
            <p className="font-body-sm text-on-surface-variant">
              Controla qué ven y qué deben completar tus clientes al reservar.
            </p>
          </div>

          <label className="flex items-start gap-3 p-md rounded-lg border border-outline-variant cursor-pointer">
            <input
              type="checkbox"
              checked={config.bookingFormEnabled}
              onChange={(e) => setConfig({ ...config, bookingFormEnabled: e.target.checked })}
              className="mt-1"
            />
            <div>
              <span className="font-label-md text-on-surface block">Formulario activo</span>
              <span className="font-body-sm text-on-surface-variant">
                Si lo desactivas, el enlace público no permitirá nuevas reservas.
              </span>
            </div>
          </label>

          <div>
            <label className="font-label-md text-on-surface mb-xs block">Texto de introducción</label>
            <textarea
              value={config.bookingIntroText}
              onChange={(e) => setConfig({ ...config, bookingIntroText: e.target.value })}
              rows={2}
              placeholder="Ej: Reserva tu cita en pocos pasos. Te esperamos."
              className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
            />
            <p className="font-body-sm text-on-surface-variant mt-1">
              Se muestra al inicio del formulario. Si está vacío, se usa el eslogan de tu página web.
            </p>
          </div>

          <div>
            <label className="font-label-md text-on-surface mb-xs block">Mensaje al confirmar la reserva</label>
            <textarea
              value={config.bookingSuccessText}
              onChange={(e) => setConfig({ ...config, bookingSuccessText: e.target.value })}
              rows={2}
              placeholder="Ej: ¡Listo! Te esperamos. Si necesitas cambiar la cita, escríbenos."
              className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="font-label-md text-on-surface mb-2 block">Espacio entre citas</label>
            <div className="flex flex-wrap gap-2">
              {SLOT_GAP_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setConfig({ ...config, slotGapMinutes: mins })}
                  className={`px-4 py-2 rounded-lg border font-label-md font-bold transition-all ${
                    config.slotGapMinutes === mins
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-outline-variant text-on-surface hover:border-primary/40'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
            <p className="font-body-sm text-on-surface-variant mt-2">
              Tiempo libre después de cada cita antes de la siguiente.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <label className="flex items-start gap-3 p-md rounded-lg border border-outline-variant cursor-pointer">
              <input
                type="checkbox"
                checked={config.bookingRequirePhone}
                onChange={(e) => setConfig({ ...config, bookingRequirePhone: e.target.checked })}
                className="mt-1"
              />
              <div>
                <span className="font-label-md text-on-surface block">Teléfono obligatorio</span>
                <span className="font-body-sm text-on-surface-variant">El cliente debe ingresar su número</span>
              </div>
            </label>
            <label className="flex items-start gap-3 p-md rounded-lg border border-outline-variant cursor-pointer">
              <input
                type="checkbox"
                checked={config.bookingRequireEmail}
                onChange={(e) => setConfig({ ...config, bookingRequireEmail: e.target.checked })}
                className="mt-1"
              />
              <div>
                <span className="font-label-md text-on-surface block">Correo obligatorio</span>
                <span className="font-body-sm text-on-surface-variant">El cliente debe ingresar su email</span>
              </div>
            </label>
            <label className="flex items-start gap-3 p-md rounded-lg border border-outline-variant cursor-pointer">
              <input
                type="checkbox"
                checked={config.bookingShowNotes}
                onChange={(e) => setConfig({ ...config, bookingShowNotes: e.target.checked })}
                className="mt-1"
              />
              <div>
                <span className="font-label-md text-on-surface block">Mostrar campo de notas</span>
                <span className="font-body-sm text-on-surface-variant">Comentarios o requerimientos especiales</span>
              </div>
            </label>
            <label className="flex items-start gap-3 p-md rounded-lg border border-outline-variant cursor-pointer">
              <input
                type="checkbox"
                checked={config.bookingConfirmAuto}
                onChange={(e) => setConfig({ ...config, bookingConfirmAuto: e.target.checked })}
                className="mt-1"
              />
              <div>
                <span className="font-label-md text-on-surface block">Confirmar citas automáticamente</span>
                <span className="font-body-sm text-on-surface-variant">
                  Si no, quedan como pendientes hasta que las confirmes
                </span>
              </div>
            </label>
          </div>

          <div className="flex flex-wrap gap-3 pt-sm">
            <button
              type="submit"
              disabled={saving}
              className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </button>
            <Link
              href="/dashboard/services"
              className="px-lg py-3 border border-outline-variant rounded-lg font-label-md font-bold hover:bg-surface-container-low"
            >
              Servicios y horarios
            </Link>
          </div>
        </form>
      )}

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
            <li>Configura el formulario (campos, textos, espacio entre citas).</li>
            <li>Crea tus servicios y horarios de atención.</li>
            <li>Copia y comparte el enlace público.</li>
            <li>Las citas aparecen en tu panel y calendario.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
