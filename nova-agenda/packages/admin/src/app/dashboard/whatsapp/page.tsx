'use client';

import { useEffect, useState } from 'react';
import { api, WhatsAppConfig } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import PasswordInput from '@/components/PasswordInput';

interface WhatsAppLog {
  id: string;
  phoneNumber: string;
  direction: 'INBOUND' | 'OUTBOUND';
  message: string;
  intent?: string;
  createdAt: string;
}

const DEFAULT_AI =
  'Eres un asistente amable y profesional de un negocio de belleza. Tu objetivo es ayudar a los clientes con información y reservar citas.';

export default function WhatsAppPage() {
  const { user } = useAuth();
  const [clientPlan, setClientPlan] = useState<string>('FREE');
  const [clientAddons, setClientAddons] = useState<string[]>([]);
  const [config, setConfig] = useState<WhatsAppConfig>({
    isOpenAIEnabled: true,
    aiPersonality: DEFAULT_AI,
    isActive: false,
  });
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const clientId = user?.clientId;

  async function loadData() {
    if (!clientId) return;
    try {
      const [configData, logsData] = await Promise.all([
        api.getWhatsAppConfig(clientId),
        api.getWhatsAppLogs(clientId, 30),
      ]);
      if (configData) {
        setConfig(configData);
        setAccountSid(configData.twilioAccountSid || '');
        setFromNumber(configData.phoneNumberId || '');
        setAuthToken(configData.hasAuthToken ? configData.twilioAuthTokenMasked || '' : '');
      }
      setLogs(logsData.logs || []);
      try {
        const status = await api.getWhatsAppConnection(clientId);
        setConnectionStatus(status.connected ? 'connected' : 'disconnected');
      } catch {
        setConnectionStatus(configData?.isConfigured ? 'unknown' : 'disconnected');
      }
    } catch (error) {
      console.error('Error loading WhatsApp data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!clientId) return;
    loadData();
    api.getClient(clientId).then((c) => {
      setClientPlan(c.plan);
      setClientAddons(c.addons || []);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handleSaveCredentials() {
    if (!clientId) return;
    setSaving(true);
    setMessage('');
    try {
      const tokenChanged = authToken.trim() && !authToken.includes('•');
      const saved = await api.updateWhatsAppConfig(clientId, {
        twilioAccountSid: accountSid.trim(),
        phoneNumberId: fromNumber.trim(),
        ...(tokenChanged ? { twilioAuthToken: authToken.trim() } : {}),
        isOpenAIEnabled: config.isOpenAIEnabled,
        aiPersonality: config.aiPersonality,
      });
      setConfig(saved);
      setAccountSid(saved.twilioAccountSid || '');
      setFromNumber(saved.phoneNumberId || '');
      setAuthToken(saved.hasAuthToken ? saved.twilioAuthTokenMasked || '' : '');
      setMessage('Credenciales de Twilio guardadas');
      const status = await api.getWhatsAppConnection(clientId);
      setConnectionStatus(status.connected ? 'connected' : 'disconnected');
    } catch (error: unknown) {
      setMessage('Error: ' + (error instanceof Error ? error.message : 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAi() {
    if (!clientId) return;
    setSaving(true);
    setMessage('');
    try {
      const saved = await api.updateWhatsAppConfig(clientId, {
        isOpenAIEnabled: config.isOpenAIEnabled,
        aiPersonality: config.aiPersonality,
      });
      setConfig((prev) => ({ ...prev, ...saved }));
      setMessage('Configuración de IA guardada');
    } catch (error: unknown) {
      setMessage('Error: ' + (error instanceof Error ? error.message : 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!clientId) return;
    setToggling(true);
    setMessage('');
    try {
      const result = await api.toggleWhatsApp(clientId);
      setConfig((prev) => ({ ...prev, isActive: result.isActive }));
      setMessage(result.isActive ? 'WhatsApp activado' : 'WhatsApp pausado');
    } catch (error: unknown) {
      setMessage('Error: ' + (error instanceof Error ? error.message : 'No se pudo cambiar el estado'));
    } finally {
      setToggling(false);
    }
  }

  async function handleTestMessage() {
    if (!clientId || !testPhone || !testMessage) return;
    setSendingTest(true);
    setMessage('');
    try {
      await api.sendWhatsAppTest(clientId, testPhone, testMessage);
      setMessage('Mensaje de prueba enviado');
      setTestMessage('');
      const logsData = await api.getWhatsAppLogs(clientId, 30);
      setLogs(logsData.logs || []);
    } catch (error: unknown) {
      setMessage('Error: ' + (error instanceof Error ? error.message : 'No se pudo enviar'));
    } finally {
      setSendingTest(false);
    }
  }

  async function copyWebhook() {
    if (!config.webhookUrl) return;
    await navigator.clipboard.writeText(config.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-gutter animate-pulse">
        <div className="glass-card rounded-xl h-12" />
        <div className="glass-card rounded-xl h-96" />
      </div>
    );
  }

  const hasWhatsappAddon = clientAddons.includes('WHATSAPP_AI');

  if (!hasWhatsappAddon) {
    return (
      <div className="space-y-gutter">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">WhatsApp con IA</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Conecta WhatsApp con Twilio para atender citas automáticamente
          </p>
        </div>
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm text-center py-16">
          <div className="w-16 h-16 bg-tertiary-container rounded-full flex items-center justify-center mx-auto mb-lg">
            <span className="material-symbols-outlined text-3xl text-on-tertiary-container">smart_toy</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">
            Addon: WhatsApp con IA + Chatbot
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant mb-lg max-w-md mx-auto">
            Este es un addon de <strong>$499/mes</strong> aparte de tu plan. Incluye chatbot con IA 24/7
            y reserva de citas por WhatsApp usando tu cuenta de Twilio.
          </p>
          <a
            href="mailto:ventas@novagenda.com?subject=Quiero%20el%20addon%20de%20WhatsApp%20con%20IA%20(%24499%2Fmes)"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-md shadow-primary/20 hover:opacity-90 transition-all"
          >
            <span className="material-symbols-outlined">upgrade</span>
            Solicitar addon de WhatsApp
          </a>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-lg">
            Plan actual: {clientPlan}
          </p>
        </div>
      </div>
    );
  }

  const isConnected = connectionStatus === 'connected';
  const readyToTest = Boolean(config.isConfigured && config.isActive);

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">WhatsApp Business</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Conecta tu número con Twilio. Por ahora pegas las credenciales a mano.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              isConnected
                ? 'bg-secondary-container/30 text-on-secondary-container'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-secondary' : 'bg-on-surface-variant'}`} />
            <span className="font-label-md text-label-md">
              {isConnected ? 'Twilio válido' : config.isConfigured ? 'Revisa las credenciales' : 'Sin configurar'}
            </span>
          </div>
          {config.isConfigured && (
            <button
              type="button"
              onClick={handleToggle}
              disabled={toggling}
              className={`px-4 py-2 rounded-lg font-label-md ${
                config.isActive ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'
              }`}
            >
              {toggling ? '…' : config.isActive ? 'Activo' : 'Pausado'}
            </button>
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
          <p className="font-body-sm text-body-sm">{message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">key</span>
            Credenciales de Twilio
          </h3>
          <ol className="space-y-2 mb-lg font-body-sm text-on-surface-variant">
            <li>1. En Twilio Console copia el Account SID y el Auth Token.</li>
            <li>2. Activa WhatsApp (Sandbox o número aprobado) y copia el número.</li>
            <li>3. En Messaging, pega la URL de webhook de abajo en “When a message comes in” (POST).</li>
          </ol>
          <div className="space-y-md">
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Account SID</label>
              <input
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg outline-none focus:border-primary"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Auth Token</label>
              <PasswordInput
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Pega el token (se guarda cifrado en el servidor)"
              />
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Número de WhatsApp</label>
              <input
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg outline-none focus:border-primary"
                placeholder="+14155238886"
              />
              <p className="font-body-sm text-on-surface-variant mt-1">Formato internacional, con +.</p>
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Webhook de mensajes entrantes</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={config.webhookUrl || ''}
                  className="flex-1 px-4 py-3 bg-surface-container-low border border-outline-variant rounded-lg font-body-sm"
                />
                <button
                  type="button"
                  onClick={copyWebhook}
                  className="px-4 py-3 rounded-lg border border-outline-variant font-label-md"
                >
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
            <button
              onClick={handleSaveCredentials}
              disabled={saving}
              className="w-full py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar Twilio'}
            </button>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary">smart_toy</span>
            Asistente con IA
          </h3>
          <div className="space-y-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-label-md text-on-surface">Asistente IA habilitado</p>
                <p className="font-body-sm text-on-surface-variant">Responde mensajes automáticamente</p>
              </div>
              <button
                type="button"
                onClick={() => setConfig({ ...config, isOpenAIEnabled: !config.isOpenAIEnabled })}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  config.isOpenAIEnabled ? 'bg-primary' : 'bg-surface-container-highest'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    config.isOpenAIEnabled ? 'left-6' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Personalidad del asistente</label>
              <textarea
                value={config.aiPersonality}
                onChange={(e) => setConfig({ ...config, aiPersonality: e.target.value })}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg outline-none focus:border-primary"
                rows={5}
              />
            </div>
            <button
              onClick={handleSaveAi}
              disabled={saving}
              className="w-full py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar IA'}
            </button>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">send</span>
            Mensaje de prueba
          </h3>
          <div className="space-y-lg">
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Número de destino</label>
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg outline-none focus:border-primary"
                placeholder="+52155..."
              />
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Mensaje</label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg outline-none focus:border-primary"
                rows={3}
              />
            </div>
            <button
              onClick={handleTestMessage}
              disabled={sendingTest || !testPhone || !testMessage || !readyToTest}
              className="w-full py-3 bg-secondary text-on-secondary rounded-lg font-label-md font-bold disabled:opacity-50"
            >
              {sendingTest ? 'Enviando…' : 'Enviar prueba'}
            </button>
            {!readyToTest && (
              <p className="font-body-sm text-on-surface-variant text-center">
                Guarda Twilio y deja el canal activo para enviar pruebas.
              </p>
            )}
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
            <h3 className="font-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">chat</span>
              Historial de conversaciones
            </h3>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="p-lg text-center text-on-surface-variant font-body-sm">No hay mensajes aún</div>
            ) : (
              <div className="divide-y divide-outline-variant">
                {logs.map((log) => (
                  <div key={log.id} className="p-md">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          log.direction === 'INBOUND'
                            ? 'bg-primary-container text-on-primary-container'
                            : 'bg-secondary-container text-on-secondary-container'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {log.direction === 'INBOUND' ? 'call_received' : 'call_made'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-label-sm text-on-surface">{log.phoneNumber}</span>
                          {log.intent && (
                            <span className="px-2 py-0.5 bg-primary-fixed text-on-primary-fixed-variant rounded text-[10px] font-bold uppercase">
                              {log.intent}
                            </span>
                          )}
                          <span className="font-body-sm text-on-surface-variant ml-auto">
                            {new Date(log.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="font-body-sm text-on-surface-variant line-clamp-2">{log.message}</p>
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
  );
}
