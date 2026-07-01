'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Tab = 'stripe' | 'evo_cloud' | 'openai';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('stripe');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [stripe, setStripe] = useState({
    stripe_secret_key: '',
    stripe_publishable_key: '',
    stripe_webhook_secret: '',
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
    loadConfig();
  }, []);

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

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant">lock</span>
          <p className="font-body-md text-body-md text-on-surface-variant mt-4">Solo los administradores pueden acceder a la configuración</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-gutter animate-pulse">
        <div className="glass-card rounded-xl h-12" />
        <div className="glass-card rounded-xl h-96" />
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
                <input
                  type="password"
                  value={stripe.stripe_secret_key}
                  onChange={(e) => setStripe({ ...stripe, stripe_secret_key: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
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
                <input
                  type="password"
                  value={stripe.stripe_webhook_secret}
                  onChange={(e) => setStripe({ ...stripe, stripe_webhook_secret: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="whsec_..."
                />
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Price ID</label>
                <input
                  value={stripe.stripe_price_id}
                  onChange={(e) => setStripe({ ...stripe, stripe_price_id: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="price_..."
                />
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">ID del precio de suscripción</p>
              </div>
            </div>

            <div className="p-4 bg-primary-fixed/30 rounded-lg">
              <p className="font-body-sm text-body-sm text-on-primary-fixed-variant">
                <strong>Webhook URL:</strong> https://tu-api.up.railway.app/api/stripe/webhook
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
                <input
                  type="password"
                  value={evoCloud.evo_cloud_api_key}
                  onChange={(e) => setEvoCloud({ ...evoCloud, evo_cloud_api_key: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
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
                <input
                  type="password"
                  value={openai.openai_api_key}
                  onChange={(e) => setOpenai({ ...openai, openai_api_key: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
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
