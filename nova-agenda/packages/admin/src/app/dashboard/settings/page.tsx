'use client';

import { useEffect, useState } from 'react';
import { api, ClientStripeConfig } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import PasswordInput from '@/components/PasswordInput';

type Tab = 'stripe' | 'evo_cloud' | 'openai';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('stripe');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [clientStripe, setClientStripe] = useState<ClientStripeConfig>({
    mode: 'test',
    test: { configured: false, hasSecretKey: false, hasPublishableKey: false, hasWebhookSecret: false },
    live: { configured: false, hasSecretKey: false, hasPublishableKey: false, hasWebhookSecret: false },
    configured: false,
    secretKey: '',
    publishableKey: '',
    webhookSecret: '',
    hasSecretKey: false,
    hasPublishableKey: false,
    hasWebhookSecret: false,
  });
  const [editMode, setEditMode] = useState<'test' | 'live'>('test');
  const [testKeys, setTestKeys] = useState({ secretKey: '', publishableKey: '', webhookSecret: '' });
  const [liveKeys, setLiveKeys] = useState({ secretKey: '', publishableKey: '', webhookSecret: '' });
  const [switchingMode, setSwitchingMode] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [stripe, setStripe] = useState({
    stripe_secret_key: '',
    stripe_publishable_key: '',
    stripe_webhook_secret: '',
    stripe_price_id_basic: '',
    stripe_price_id_pro: '',
    stripe_price_id: '',
  });

  const [evoCloud, setEvoCloud] = useState({
    evo_cloud_api_url: 'https://api.evo.cloud',
    evo_cloud_api_key: '',
    evo_cloud_instance_id: '',
  });

  const [openai, setOpenai] = useState({
    openai_api_key: '',
    openai_model: 'gpt-4o',
    openai_max_tokens: '500',
  });

  useEffect(() => {
    if (isSuperAdmin) {
      loadConfig();
    } else {
      loadClientStripe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadClientStripe() {
    try {
      const data = await api.getClientStripeConfig();
      setClientStripe((prev) => ({ ...prev, ...data }));
    } catch (error) {
      console.error('Error loading client Stripe config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadConfig() {
    try {
      const data = await api.getPlatformConfig();
      if (data.stripe) setStripe(data.stripe as typeof stripe);
      if (data.evo_cloud) setEvoCloud(data.evo_cloud as typeof evoCloud);
      if (data.openai) setOpenai(data.openai as typeof openai);
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      if (!isSuperAdmin) {
        const keys = editMode === 'test' ? testKeys : liveKeys;
        const data = await api.updateClientStripeConfig({ mode: editMode, ...keys });
        setClientStripe((prev) => ({ ...prev, ...data }));
        if (editMode === 'test') setTestKeys({ secretKey: '', publishableKey: '', webhookSecret: '' });
        else setLiveKeys({ secretKey: '', publishableKey: '', webhookSecret: '' });
        setMessage(`Configuración de Stripe (modo ${editMode === 'test' ? 'prueba' : 'producción'}) guardada exitosamente`);
        return;
      }

      switch (activeTab) {
        case 'stripe':
          await api.updatePlatformConfig('stripe', stripe);
          break;
        case 'evo_cloud':
          await api.updatePlatformConfig('evo_cloud', evoCloud);
          break;
        case 'openai':
          await api.updatePlatformConfig('openai', openai);
          break;
      }
      setMessage('Configuración guardada exitosamente');
    } catch (error: any) {
      setMessage('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function switchActiveMode(next: 'test' | 'live') {
    const target = next === 'test' ? clientStripe.test : clientStripe.live;
    const label = next === 'test' ? 'prueba' : 'producción';
    if (!target.configured) {
      const confirmed = window.confirm(
        `El modo ${label} aún no tiene una Secret Key guardada. Si lo activas, los cobros usarán la cuenta de la plataforma hasta que configures el modo ${label}. ¿Deseas activarlo de todos modos?`
      );
      if (!confirmed) return;
    }
    setSwitchingMode(true);
    setMessage('');
    try {
      const data = await api.updateClientStripeConfig({ activeMode: next });
      setClientStripe((prev) => ({ ...prev, ...data }));
      setMessage(`Modo activo cambiado a ${label === 'producción' ? 'producción' : 'prueba'}.`);
    } catch (error: any) {
      setMessage('Error: ' + error.message);
    } finally {
      setSwitchingMode(false);
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

  if (!isSuperAdmin) {
    const keys = editMode === 'test' ? testKeys : liveKeys;
    const setKeys = (patch: Partial<typeof testKeys>) =>
      editMode === 'test' ? setTestKeys({ ...testKeys, ...patch }) : setLiveKeys({ ...liveKeys, ...patch });
    const editStatus = clientStripe[editMode];

    return (
      <div className="space-y-gutter">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Configuración de Cobros</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Conecta tu propia cuenta de Stripe para cobrar a tus clientes</p>
        </div>

        {message && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${
            message.startsWith('Error') ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'
          }`}>
            <span className="material-symbols-outlined">{message.startsWith('Error') ? 'error' : 'check_circle'}</span>
            <p className="font-body-sm text-body-sm">{message}</p>
          </div>
        )}

        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm space-y-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#635bff] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface">Stripe</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Tu cuenta de Stripe para recibir pagos de tus clientes. Guarda claves de prueba y de producción, y alterna el modo activo cuando quieras.</p>
            </div>
          </div>

          {/* Estado de cada modo + switch de modo activo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-lg">
            {([
              { key: 'test' as const, label: 'Prueba', icon: 'science', desc: 'Pagos simulados, no mueve dinero real', env: 'sk_test_' },
              { key: 'live' as const, label: 'Producción', icon: 'verified', desc: 'Cobros reales a tus clientes', env: 'sk_live_' },
            ]).map(({ key, label, icon, desc, env }) => {
              const status = clientStripe[key];
              const active = clientStripe.mode === key;
              return (
                <div key={key} className={`p-4 rounded-lg border flex flex-col gap-3 ${
                  active
                    ? 'bg-secondary-container/40 border-secondary text-on-secondary-container'
                    : 'bg-surface-container-low border-outline-variant text-on-surface-variant'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-label-md text-label-md font-bold flex items-center gap-2 uppercase tracking-wider">
                      <span className="material-symbols-outlined text-lg">{icon}</span>
                      {label}
                    </span>
                    {active && (
                      <span className="px-2.5 py-0.5 bg-secondary text-on-secondary rounded-full text-[10px] font-bold uppercase">Activo</span>
                    )}
                  </div>
                  <p className="font-body-sm text-body-sm">{desc}</p>
                  <p className="font-body-sm text-body-sm">
                    {status.configured
                      ? `Claves guardadas (${status.hasSecretKey ? 'secret ✓' : 'sin secret'} · ${status.hasPublishableKey ? 'pk ✓' : 'sin pk'} · ${status.hasWebhookSecret ? 'whsec ✓' : 'sin whsec'})`
                      : `No configurado. Claves de ${label.toLowerCase()} en tu Dashboard de Stripe (${env}...).`}
                  </p>
                  {!active && (
                    <button
                      onClick={() => switchActiveMode(key)}
                      disabled={switchingMode}
                      className={`self-start mt-auto px-4 py-2 rounded-lg font-label-sm text-label-sm font-bold transition-all disabled:opacity-50 ${
                        status.configured
                          ? 'bg-primary text-on-primary shadow-md shadow-primary/20 hover:opacity-90'
                          : 'border border-outline text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {switchingMode ? 'Cambiando...' : `Usar modo ${label.toLowerCase()}`}
                    </button>
                  )}
                  {active && (
                    <p className="font-body-sm text-body-sm mt-auto font-bold text-on-secondary-container">
                      Este modo está recibiendo los cobros ahora mismo.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selector de qué modo se está editando */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md p-4 bg-primary-fixed/20 border border-outline-variant rounded-lg">
            <div>
              <p className="font-label-md text-label-md text-on-surface font-bold">Editar claves de</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Cada modo guarda su propio par de claves.</p>
            </div>
            <div className="flex gap-2">
              {([
                { key: 'test' as const, label: 'Prueba' },
                { key: 'live' as const, label: 'Producción' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setEditMode(key); setMessage(''); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-label-md text-label-md whitespace-nowrap transition-all ${
                    editMode === key
                      ? 'bg-primary text-on-primary shadow-md'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{key === 'test' ? 'science' : 'verified'}</span>
                  {label}
                  {clientStripe[key].configured && (
                    <span className={`w-2 h-2 rounded-full ${editMode === key ? 'bg-on-primary' : 'bg-secondary'}`} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Claves del modo en edición */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Secret Key ({editMode === 'test' ? 'sk_test_' : 'sk_live_'})</label>
              <PasswordInput
                value={keys.secretKey}
                onChange={(e) => setKeys({ secretKey: e.target.value })}
                placeholder={editStatus.hasSecretKey ? 'sk_•••••••••••• (guardada)' : `${editMode === 'test' ? 'sk_test_' : 'sk_live_'}...`}
              />
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Créala en tu Dashboard de Stripe → Developers → API Keys. Se guarda cifrada y solo se muestra parcialmente.</p>
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Publishable Key ({editMode === 'test' ? 'pk_test_' : 'pk_live_'})</label>
              <input
                value={keys.publishableKey}
                onChange={(e) => setKeys({ publishableKey: e.target.value })}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder={editStatus.hasPublishableKey ? 'pk_•••••••• (guardada)' : `${editMode === 'test' ? 'pk_test_' : 'pk_live_'}...`}
              />
            </div>
            <div className="md:col-span-2">
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Webhook Secret (whsec_)</label>
              <PasswordInput
                value={keys.webhookSecret}
                onChange={(e) => setKeys({ webhookSecret: e.target.value })}
                placeholder={editStatus.hasWebhookSecret ? 'whsec_•••••••• (guardado)' : 'whsec_...'}
              />
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">De tu Dashboard de Stripe → Developers → Webhooks. Es opcional por ahora, pero necesario para confirmar pagos automáticamente.</p>
            </div>
          </div>

          <div className="p-4 bg-primary-fixed/30 rounded-lg space-y-2">
            <p className="font-body-sm text-body-sm text-on-primary-fixed-variant">
              <strong>Webhook de membresías:</strong>{' '}
              <code className="text-xs break-all">
                {typeof window !== 'undefined' && user?.clientId
                  ? `${window.location.origin}/api/memberships/webhook/${user.clientId}`
                  : '/api/memberships/webhook/{tu-negocio}'}
              </code>
            </p>
            <p className="font-body-sm text-body-sm text-on-primary-fixed-variant">
              En Stripe, crea un endpoint con esa URL y eventos <code>checkout.session.completed</code> y <code>customer.subscription.deleted</code>.
              El checkout también confirma el pago al volver a tu página, así que el webhook es opcional.
            </p>
            <p className="font-body-sm text-body-sm text-on-primary-fixed-variant">
              <strong>Webhook general:</strong>{' '}
              <code className="text-xs break-all">{typeof window !== 'undefined' ? window.location.origin : ''}/api/stripe/webhook</code>
            </p>
            <p className="font-body-sm text-body-sm text-on-primary-fixed-variant">
              La clave secreta, la publicable y el webhook secret deben ser del mismo modo (todos test o todos live) y pertenecer a la misma cuenta de Stripe.
              Guarda cada conjunto desde su pestaña (Prueba / Producción) y luego activa el modo que quieras cobrar. Tus clientes pagarán directamente a esta cuenta.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {saving ? 'Guardando...' : `Guardar claves de ${editMode === 'test' ? 'Prueba' : 'Producción'}`}
          </button>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'stripe', label: 'Stripe (Pagos)', icon: 'payment' },
    { id: 'evo_cloud', label: 'Evo Cloud (WhatsApp)', icon: 'chat' },
    { id: 'openai', label: 'OpenAI (IA)', icon: 'smart_toy' },
  ];

  return (
    <div className="space-y-gutter">
      <div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Configuración de Plataforma</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">Configura las integraciones globales de la plataforma</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.startsWith('Error') ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'
        }`}>
          <span className="material-symbols-outlined">{message.startsWith('Error') ? 'error' : 'check_circle'}</span>
          <p className="font-body-sm text-body-sm">{message}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setMessage(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-label-md text-label-md whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-on-primary shadow-md'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
        {/* Stripe */}
        {activeTab === 'stripe' && (
          <div className="space-y-lg">
            <div className="flex items-center gap-3 mb-lg">
              <div className="w-12 h-12 bg-[#635bff] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Stripe</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Procesamiento de pagos para suscripciones</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Secret Key</label>
                <PasswordInput
                  value={stripe.stripe_secret_key}
                  onChange={(e) => setStripe({ ...stripe, stripe_secret_key: e.target.value })}
                  placeholder="sk_live_..."
                />
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Nunca compartas esta clave</p>
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Publishable Key</label>
                <input
                  value={stripe.stripe_publishable_key}
                  onChange={(e) => setStripe({ ...stripe, stripe_publishable_key: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="pk_live_..."
                />
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Webhook Secret</label>
                <PasswordInput
                  value={stripe.stripe_webhook_secret}
                  onChange={(e) => setStripe({ ...stripe, stripe_webhook_secret: e.target.value })}
                  placeholder="whsec_..."
                />
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Price ID — PRO ($149/mes)</label>
                <input
                  value={stripe.stripe_price_id_basic}
                  onChange={(e) => setStripe({ ...stripe, stripe_price_id_basic: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="price_..."
                />
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Price ID — Business ($149/mes)</label>
                <input
                  value={stripe.stripe_price_id_pro}
                  onChange={(e) => setStripe({ ...stripe, stripe_price_id_pro: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="price_..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Price ID legacy (opcional, fallback PRO)</label>
                <input
                  value={stripe.stripe_price_id}
                  onChange={(e) => setStripe({ ...stripe, stripe_price_id: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="price_..."
                />
              </div>
            </div>

            <div className="p-4 bg-primary-fixed/30 rounded-lg space-y-2">
              <p className="font-body-sm text-body-sm text-on-primary-fixed-variant">
                <strong>Webhook URL:</strong>{' '}
                <code className="text-xs break-all">{typeof window !== 'undefined' ? window.location.origin : ''}/api/stripe/webhook</code>
              </p>
              <p className="font-body-sm text-body-sm text-on-primary-fixed-variant">
                En Stripe Dashboard crea dos productos de suscripción mensual y pega aquí sus Price IDs (<code className="text-xs">price_...</code>).
                La clave secreta y los Price IDs deben ser del mismo modo (todos test o todos live).
              </p>
            </div>
          </div>
        )}

        {/* Evo Cloud */}
        {activeTab === 'evo_cloud' && (
          <div className="space-y-lg">
            <div className="flex items-center gap-3 mb-lg">
              <div className="w-12 h-12 bg-[#25d366] rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-white">chat</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Evo Cloud</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">API global de WhatsApp para todos los negocios</p>
              </div>
            </div>

            <div className="p-4 bg-tertiary-container/30 rounded-lg mb-lg">
              <p className="font-body-sm text-body-sm text-on-tertiary-fixed-variant">
                Esta configuración es global. Cada negocio tendrá su propio número de WhatsApp pero usa estas credenciales de la plataforma.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">API URL</label>
                <input
                  value={evoCloud.evo_cloud_api_url}
                  onChange={(e) => setEvoCloud({ ...evoCloud, evo_cloud_api_url: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">API Key</label>
                <PasswordInput
                  value={evoCloud.evo_cloud_api_key}
                  onChange={(e) => setEvoCloud({ ...evoCloud, evo_cloud_api_key: e.target.value })}
                  placeholder="Tu API Key de Evo Cloud"
                />
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Instance ID</label>
                <input
                  value={evoCloud.evo_cloud_instance_id}
                  onChange={(e) => setEvoCloud({ ...evoCloud, evo_cloud_instance_id: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="ID de la instancia"
                />
              </div>
            </div>
          </div>
        )}

        {/* OpenAI */}
        {activeTab === 'openai' && (
          <div className="space-y-lg">
            <div className="flex items-center gap-3 mb-lg">
              <div className="w-12 h-12 bg-on-surface rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-surface">smart_toy</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">OpenAI</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">IA global para el chat de WhatsApp de todos los negocios</p>
              </div>
            </div>

            <div className="p-4 bg-secondary-container/30 rounded-lg mb-lg">
              <p className="font-body-sm text-body-sm text-on-secondary-container">
                Una sola cuenta de OpenAI atiende todos los negocios. El sistema automaticamente separa el contexto de cada negocio usando sus servicios, horarios y personalidad configurados individualmente.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
              <div className="md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface mb-xs block">API Key</label>
                <PasswordInput
                  value={openai.openai_api_key}
                  onChange={(e) => setOpenai({ ...openai, openai_api_key: e.target.value })}
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Modelo</label>
                <select
                  value={openai.openai_model}
                  onChange={(e) => setOpenai({ ...openai, openai_model: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="gpt-4o">GPT-4o (Recomendado)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (Más barato)</option>
                  <option value="gpt-4.1">GPT-4.1 (Último)</option>
                </select>
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Max Tokens</label>
                <input
                  type="number"
                  value={openai.openai_max_tokens}
                  onChange={(e) => setOpenai({ ...openai, openai_max_tokens: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  min="100"
                  max="2000"
                />
              </div>
            </div>

            <div className="p-4 bg-primary-fixed/30 rounded-lg">
              <p className="font-body-sm text-body-sm text-on-primary-fixed-variant">
                <strong>Costo estimado:</strong> ~$0.005 por mensaje de WhatsApp (GPT-4o). Cada negocio tiene su propio contexto de servicios y horarios.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
