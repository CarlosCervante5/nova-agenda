'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface WhatsAppConfig {
  id?: string;
  phoneNumberId: string;
  apiKey: string;
  instanceId: string;
  isOpenAIEnabled: boolean;
  aiPersonality: string;
  isActive: boolean;
}

interface WhatsAppLog {
  id: string;
  phoneNumber: string;
  direction: 'INBOUND' | 'OUTBOUND';
  message: string;
  intent?: string;
  createdAt: string;
}

export default function WhatsAppPage() {
  const { user } = useAuth();
  const [clientPlan, setClientPlan] = useState<string>('FREE');
  const [config, setConfig] = useState<WhatsAppConfig>({
    phoneNumberId: '',
    apiKey: '',
    instanceId: '',
    isOpenAIEnabled: true,
    aiPersonality: 'Eres un asistente amable y profesional de un negocio de belleza. Tu objetivo es ayudar a los clientes con información y reservar citas.',
    isActive: false,
  });
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  const [message, setMessage] = useState('');

  const clientId = user?.clientId;

  useEffect(() => {
    if (clientId) {
      loadData();
      api.getClient(clientId).then(c => setClientPlan(c.plan)).catch(() => {});
    }
  }, [clientId]);

  async function loadData() {
    if (!clientId) return;
    try {
      const [configData, logsData] = await Promise.all([
        api.getWhatsAppConfig(clientId),
        api.getWhatsAppLogs(clientId, 30),
      ]);
      if (configData) {
        setConfig(configData);
      }
      setLogs(logsData.logs || []);
      
      // Check connection status
      try {
        const status = await api.getWhatsAppStatus(clientId);
        setConnectionStatus(status.connected ? 'connected' : 'disconnected');
      } catch {
        setConnectionStatus('unknown');
      }
    } catch (error) {
      console.error('Error loading WhatsApp data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!clientId) return;
    setSaving(true);
    setMessage('');
    try {
      await api.updateWhatsAppConfig(clientId, config);
      setMessage('Configuración guardada exitosamente');
      loadData();
    } catch (error: any) {
      setMessage('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!clientId) return;
    try {
      const result = await api.toggleWhatsApp(clientId);
      setConfig(prev => ({ ...prev, isActive: result.isActive }));
      setMessage(result.isActive ? 'WhatsApp activado' : 'WhatsApp desactivado');
    } catch (error: any) {
      setMessage('Error: ' + error.message);
    }
  }

  async function handleTestMessage() {
    if (!clientId || !testPhone || !testMessage) return;
    setSendingTest(true);
    try {
      await api.sendWhatsAppTest(clientId, testPhone, testMessage);
      setMessage('Mensaje de prueba enviado');
      setTestMessage('');
    } catch (error: any) {
      setMessage('Error: ' + error.message);
    } finally {
      setSendingTest(false);
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

  if (clientPlan !== 'PRO') {
    return (
      <div className="space-y-gutter">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">WhatsApp Business</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Configura la integración de WhatsApp con Evo Cloud y OpenAI</p>
        </div>
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm text-center py-16">
          <div className="w-16 h-16 bg-tertiary-container rounded-full flex items-center justify-center mx-auto mb-lg">
            <span className="material-symbols-outlined text-3xl text-on-tertiary-container">lock</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">Función exclusiva del plan Business</h3>
          <p className="font-body-md text-body-md text-on-surface-variant mb-lg max-w-md mx-auto">
            WhatsApp con IA solo está disponible en el plan Business (PRO). Actualiza tu plan para acceder a esta función.
          </p>
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold">
            <span className="material-symbols-outlined">upgrade</span>
            Plan Actual: {clientPlan}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-gutter">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">WhatsApp Business</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Configura la integración de WhatsApp con Evo Cloud y OpenAI</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            connectionStatus === 'connected' ? 'bg-secondary-container/30 text-on-secondary-container' :
            connectionStatus === 'disconnected' ? 'bg-error-container/30 text-on-error-container' :
            'bg-surface-container-high text-on-surface-variant'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-secondary' :
              connectionStatus === 'disconnected' ? 'bg-error' :
              'bg-on-surface-variant'
            }`} />
            <span className="font-label-md text-label-md">
              {connectionStatus === 'connected' ? 'Conectado' :
               connectionStatus === 'disconnected' ? 'Desconectado' :
               'Estado desconocido'}
            </span>
          </div>
          <button
            onClick={handleToggle}
            className={`px-md py-2.5 rounded-lg font-label-md text-label-md font-bold transition-all ${
              config.isActive
                ? 'bg-error-container text-on-error-container hover:bg-error/20'
                : 'bg-primary text-on-primary hover:opacity-90'
            }`}
          >
            {config.isActive ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.startsWith('Error') ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'
        }`}>
          <span className="material-symbols-outlined">{message.startsWith('Error') ? 'error' : 'check_circle'}</span>
          <p className="font-body-sm text-body-sm">{message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        {/* Instructions */}
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary">menu_book</span>
            Instrucciones de Configuración
          </h3>
          <div className="space-y-lg text-on-surface-variant">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 font-bold text-sm">1</div>
              <div>
                <p className="font-label-md text-label-md text-on-surface mb-xs">Crea una cuenta en Evo Cloud</p>
                <p className="font-body-sm text-body-sm">Regístrate en <a href="https://evo.cloud" target="_blank" className="text-primary underline">evo.cloud</a> y crea una nueva instancia de WhatsApp.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 font-bold text-sm">2</div>
              <div>
                <p className="font-label-md text-label-md text-on-surface mb-xs">Obtén tus credenciales</p>
                <p className="font-body-sm text-body-sm">En el panel de Evo Cloud, copia el <strong>Phone Number ID</strong>, <strong>API Key</strong> e <strong>Instance ID</strong>.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 font-bold text-sm">3</div>
              <div>
                <p className="font-label-md text-label-md text-on-surface mb-xs">Completa el formulario</p>
                <p className="font-body-sm text-body-sm">Ingresa las credenciales en los campos de la derecha y guarda la configuración.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 font-bold text-sm">4</div>
              <div>
                <p className="font-label-md text-label-md text-on-surface mb-xs">Configura el Webhook</p>
                <p className="font-body-sm text-body-sm">En Evo Cloud, configura el webhook URL a: <code className="bg-surface-container-high px-2 py-1 rounded text-xs">https://tu-dominio.com/api/whatsapp/webhook</code></p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 font-bold text-sm">5</div>
              <div>
                <p className="font-label-md text-label-md text-on-surface mb-xs">Activa y prueba</p>
                <p className="font-body-sm text-body-sm">Haz clic en "Activar" y envía un mensaje de prueba para verificar que todo funciona.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div className="space-y-gutter">
          <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">settings</span>
              Configuración de Evo Cloud
            </h3>
            <div className="space-y-lg">
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Phone Number ID *</label>
                <input
                  value={config.phoneNumberId}
                  onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="ID del número de teléfono en Evo Cloud"
                />
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">API Key *</label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="Tu API Key de Evo Cloud"
                />
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Instance ID</label>
                <input
                  value={config.instanceId}
                  onChange={(e) => setConfig({ ...config, instanceId: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="ID de la instancia de WhatsApp"
                />
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary">smart_toy</span>
              Configuración de IA (OpenAI)
            </h3>
            <div className="space-y-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-label-md text-label-md text-on-surface">Asistente IA habilitado</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Usar GPT-4o para responder mensajes</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, isOpenAIEnabled: !config.isOpenAIEnabled })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    config.isOpenAIEnabled ? 'bg-primary' : 'bg-surface-container-highest'
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    config.isOpenAIEnabled ? 'left-6' : 'left-0.5'
                  }`} />
                </button>
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Personalidad del Asistente</label>
                <textarea
                  value={config.aiPersonality}
                  onChange={(e) => setConfig({ ...config, aiPersonality: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  rows={4}
                  placeholder="Instrucciones personalizadas para el asistente de IA..."
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !config.phoneNumberId || !config.apiKey}
            className="w-full py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>

        {/* Test & Logs */}
        <div className="space-y-gutter">
          {/* Test Message */}
          <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">send</span>
              Enviar Mensaje de Prueba
            </h3>
            <div className="space-y-lg">
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Número de WhatsApp</label>
                <input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="Ej: 5491155551234"
                />
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface mb-xs block">Mensaje</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  rows={3}
                  placeholder="Escribe un mensaje de prueba..."
                />
              </div>
              <button
                onClick={handleTestMessage}
                disabled={sendingTest || !testPhone || !testMessage}
                className="w-full py-3 bg-secondary text-on-secondary rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-secondary/20 hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {sendingTest ? 'Enviando...' : 'Enviar Prueba'}
              </button>
            </div>
          </div>

          {/* Chat Logs */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
              <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">chat</span>
                Historial de Conversaciones
              </h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
              {logs.length === 0 ? (
                <div className="p-lg text-center text-on-surface-variant font-body-sm text-body-sm">
                  No hay mensajes aún
                </div>
              ) : (
                <div className="divide-y divide-outline-variant">
                  {logs.map((log) => (
                    <div key={log.id} className="p-md hover:bg-surface-container-low/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          log.direction === 'INBOUND' ? 'bg-primary-container text-on-primary-container' : 'bg-secondary-container text-on-secondary-container'
                        }`}>
                          <span className="material-symbols-outlined text-sm">
                            {log.direction === 'INBOUND' ? 'call_received' : 'call_made'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-label-sm text-label-sm text-on-surface">{log.phoneNumber}</span>
                            {log.intent && (
                              <span className="px-2 py-0.5 bg-primary-fixed text-on-primary-fixed-variant rounded text-[10px] font-bold uppercase">
                                {log.intent}
                              </span>
                            )}
                            <span className="font-body-sm text-body-sm text-on-surface-variant ml-auto">
                              {new Date(log.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">{log.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
