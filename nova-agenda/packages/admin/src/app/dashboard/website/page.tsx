'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Client } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getBookingFormUrl, getClientPortalBaseUrl } from '@/lib/booking-url';

const PLAN_LEVELS: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2 };

type WebsiteForm = {
  name: string;
  slug: string;
  domain: string;
  email: string;
  phone: string;
  address: string;
  logo: string;
  primaryColor: string;
  tagline: string;
  about: string;
  coverImage: string;
  instagram: string;
  facebook: string;
  whatsappPhone: string;
  websiteEnabled: boolean;
};

const emptyForm: WebsiteForm = {
  name: '',
  slug: '',
  domain: '',
  email: '',
  phone: '',
  address: '',
  logo: '',
  primaryColor: '#2dd4bf',
  tagline: '',
  about: '',
  coverImage: '',
  instagram: '',
  facebook: '',
  whatsappPhone: '',
  websiteEnabled: true,
};

function clientToForm(client: Client): WebsiteForm {
  return {
    name: client.name || '',
    slug: client.slug || '',
    domain: client.domain || '',
    email: client.email || '',
    phone: client.phone || '',
    address: client.address || '',
    logo: client.logo || '',
    primaryColor: client.primaryColor || '#2dd4bf',
    tagline: client.tagline || '',
    about: client.about || '',
    coverImage: client.coverImage || '',
    instagram: client.instagram || '',
    facebook: client.facebook || '',
    whatsappPhone: client.whatsappPhone || '',
    websiteEnabled: client.websiteEnabled !== false,
  };
}

export default function WebsitePage() {
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [form, setForm] = useState<WebsiteForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.clientId) loadClient();
    else setLoading(false);
  }, [user]);

  async function loadClient() {
    try {
      const data = await api.getClient(user!.clientId!);
      setClient(data);
      setForm(clientToForm(data));
    } catch (error) {
      console.error(error);
      setMessage('Error: no se pudo cargar la configuración del sitio');
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof WebsiteForm>(key: K, value: WebsiteForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMessage('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.clientId) return;
    setSaving(true);
    setMessage('');
    try {
      const updated = await api.updateClient(user.clientId, {
        name: form.name,
        slug: form.slug,
        domain: form.domain || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        logo: form.logo || null,
        primaryColor: form.primaryColor,
        tagline: form.tagline || null,
        about: form.about || null,
        coverImage: form.coverImage || null,
        instagram: form.instagram || null,
        facebook: form.facebook || null,
        whatsappPhone: form.whatsappPhone || null,
        websiteEnabled: form.websiteEnabled,
      });
      setClient(updated);
      setForm(clientToForm(updated));
      setMessage('Página web guardada correctamente');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: unknown) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  }

  const plan = client?.plan || 'FREE';
  const hasAccess = (PLAN_LEVELS[plan] ?? 0) >= PLAN_LEVELS.BASIC;
  const publicUrl = form.slug ? getBookingFormUrl(form.slug) : '';
  const portalReady = getClientPortalBaseUrl().startsWith('http');

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <div className="glass-card rounded-xl h-96 animate-pulse" />;
  }

  if (!user?.clientId) {
    return (
      <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant text-center">
        <p className="font-body-md text-on-surface-variant">Inicia sesión con una cuenta de negocio.</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="space-y-gutter">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Mi página web</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Crea y personaliza la página pública de tu negocio
          </p>
        </div>
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-primary-container rounded-2xl flex items-center justify-center mx-auto mb-lg text-primary">
            <span className="material-symbols-outlined text-4xl">language</span>
          </div>
          <h3 className="font-headline-md text-on-surface mb-2">Disponible en plan Profesional</h3>
          <p className="font-body-sm text-on-surface-variant mb-lg">
            Personaliza colores, logo, textos, contacto, redes sociales y dominio de tu página de reservas.
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:opacity-90"
          >
            Mejorar a Profesional
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Mi página web</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Configura la página pública donde tus clientes reservan citas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {publicUrl && portalReady && (
            <>
              <button
                type="button"
                onClick={copyLink}
                className="px-md py-2.5 border border-outline-variant rounded-lg font-label-md font-bold hover:bg-surface-container-low"
              >
                {copied ? '¡Copiado!' : 'Copiar enlace'}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-md py-2.5 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:opacity-90"
              >
                Ver página
              </a>
            </>
          )}
        </div>
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

      <form onSubmit={handleSave} className="space-y-gutter">
        {/* Publicación */}
        <section className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
            <div>
              <h3 className="font-headline-md text-on-surface mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">public</span>
                Publicación
              </h3>
              <p className="font-body-sm text-on-surface-variant">
                {form.websiteEnabled
                  ? 'Tu página está visible para los clientes.'
                  : 'Tu página está oculta. Nadie puede reservar desde el enlace público.'}
              </p>
              {publicUrl && (
                <p className="font-body-sm text-on-surface mt-2 break-all">
                  <span className="text-on-surface-variant">URL: </span>
                  <code className="text-xs bg-surface-container-low px-2 py-0.5 rounded">{publicUrl}</code>
                </p>
              )}
            </div>
            <label className="flex items-center gap-3 cursor-pointer shrink-0">
              <span className="font-label-md text-on-surface">
                {form.websiteEnabled ? 'Publicada' : 'Desactivada'}
              </span>
              <input
                type="checkbox"
                checked={form.websiteEnabled}
                onChange={(e) => updateField('websiteEnabled', e.target.checked)}
                className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
              />
            </label>
          </div>
        </section>

        {/* Identidad */}
        <section className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant">
          <h3 className="font-headline-md text-on-surface mb-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">palette</span>
            Identidad de marca
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Nombre del negocio *</label>
              <input
                required
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Eslogan / frase corta</label>
              <input
                value={form.tagline}
                onChange={(e) => updateField('tagline', e.target.value)}
                placeholder="Ej: Belleza y bienestar para ti"
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Color principal</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => updateField('primaryColor', e.target.value)}
                  className="w-12 h-12 border border-outline-variant rounded-lg cursor-pointer"
                />
                <input
                  value={form.primaryColor}
                  onChange={(e) => updateField('primaryColor', e.target.value)}
                  className="flex-1 px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">URL del logo</label>
              <input
                value={form.logo}
                onChange={(e) => updateField('logo', e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
            <div className="md:col-span-2">
              <label className="font-label-md text-on-surface mb-xs block">Imagen de portada (URL)</label>
              <input
                value={form.coverImage}
                onChange={(e) => updateField('coverImage', e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
            <div className="md:col-span-2">
              <label className="font-label-md text-on-surface mb-xs block">Sobre nosotros</label>
              <textarea
                value={form.about}
                onChange={(e) => updateField('about', e.target.value)}
                rows={4}
                placeholder="Cuéntale a tus clientes quiénes son y qué ofrecen..."
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
          </div>
        </section>

        {/* Contacto */}
        <section className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant">
          <h3 className="font-headline-md text-on-surface mb-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">contact_page</span>
            Contacto
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Correo</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
            <div className="md:col-span-2">
              <label className="font-label-md text-on-surface mb-xs block">Dirección</label>
              <input
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
          </div>
        </section>

        {/* Redes */}
        <section className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant">
          <h3 className="font-headline-md text-on-surface mb-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">share</span>
            Redes sociales
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Instagram</label>
              <input
                value={form.instagram}
                onChange={(e) => updateField('instagram', e.target.value)}
                placeholder="@usuario o URL"
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Facebook</label>
              <input
                value={form.facebook}
                onChange={(e) => updateField('facebook', e.target.value)}
                placeholder="URL de la página"
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">WhatsApp (clientes)</label>
              <input
                value={form.whatsappPhone}
                onChange={(e) => updateField('whatsappPhone', e.target.value)}
                placeholder="+52..."
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
          </div>
        </section>

        {/* URL / dominio */}
        <section className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant">
          <h3 className="font-headline-md text-on-surface mb-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">link</span>
            Dirección web
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Slug (ruta pública) *</label>
              <div className="flex items-center gap-2">
                <span className="font-body-sm text-on-surface-variant shrink-0">/</span>
                <input
                  required
                  value={form.slug}
                  onChange={(e) =>
                    updateField(
                      'slug',
                      e.target.value
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-z0-9-]/g, '-')
                    )
                  }
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                />
              </div>
              <p className="font-body-sm text-on-surface-variant mt-1">
                Solo letras, números y guiones. Ejemplo: mi-salon
              </p>
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Dominio propio (opcional)</label>
              <input
                value={form.domain}
                onChange={(e) => updateField('domain', e.target.value)}
                placeholder="reservas.minegocio.com"
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
              <p className="font-body-sm text-on-surface-variant mt-1">
                Configura el DNS apuntando a client-sites. El soporte de dominio propio se activa en el portal.
              </p>
            </div>
          </div>
        </section>

        {/* Atajos */}
        <section className="bg-surface-container-low p-lg rounded-xl border border-outline-variant">
          <h3 className="font-label-md text-on-surface mb-md">También configura</h3>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/services" className="px-md py-2 rounded-lg bg-surface-container-lowest border border-outline-variant font-label-sm font-bold hover:border-primary">
              Servicios y horarios
            </Link>
            <Link href="/dashboard/booking" className="px-md py-2 rounded-lg bg-surface-container-lowest border border-outline-variant font-label-sm font-bold hover:border-primary">
              Compartir agenda
            </Link>
            <Link href="/dashboard/loyalty" className="px-md py-2 rounded-lg bg-surface-container-lowest border border-outline-variant font-label-sm font-bold hover:border-primary">
              Fidelidad
            </Link>
          </div>
        </section>

        {/* Preview card */}
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
          <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
            <h3 className="font-headline-md text-on-surface">Vista previa</h3>
          </div>
          <div
            className="h-28 relative"
            style={{
              background: form.coverImage
                ? `url(${form.coverImage}) center/cover`
                : `linear-gradient(135deg, ${form.primaryColor}33, ${form.primaryColor}88)`,
            }}
          />
          <div className="p-lg flex gap-4 items-start">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white shrink-0 overflow-hidden"
              style={{ backgroundColor: form.primaryColor }}
            >
              {form.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-2xl">spa</span>
              )}
            </div>
            <div>
              <h4 className="font-headline-md text-on-surface">{form.name || 'Tu negocio'}</h4>
              {form.tagline && (
                <p className="font-body-sm text-on-surface-variant">{form.tagline}</p>
              )}
              {form.about && (
                <p className="font-body-sm text-on-surface-variant mt-2 line-clamp-3">{form.about}</p>
              )}
            </div>
          </div>
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar página web'}
          </button>
        </div>
      </form>
    </div>
  );
}
