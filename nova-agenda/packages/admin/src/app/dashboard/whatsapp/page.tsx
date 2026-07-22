'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface WhatsAppConfig {
  id?: string;
  phoneNumberId?: string;
  apiKey?: string;
  instanceId?: string;
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
    isOpenAIEnabled: true,
    aiPersonality:
      'Eres un asistente amable y profesional de un negocio de belleza. Tu objetivo es ayudar a los clientes con información y reservar citas.',
    isActive: false,
  });
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clientId = user?.clientId;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshConnection = useCallback(async () => {
    if (!clientId) return null;
    try {
      const status = await api.getWhatsAppConnection(clientId);
      setConnectionStatus(status.connected ? 'connected' : 'disconnected');
      if (status.connected) {
        setQrCode(null);
        setConfig((prev) => ({ ...prev, isActive: true }));
        stopPolling();
      }
      return status;
    } catch {
      try {
        const fallback = await api.getWhatsAppStatus(clientId);
        setConnectionStatus(fallback.connected ? 'connected' : 'disconnected');
        return fallback;
      } catch {
        setConnectionStatus('unknown');
        return null;
      }
    }
  }, [clientId, stopPolling]);

  async function loadData() {
    if (!clientId) return;
    try {
      const [configData, logsData] = await Promise.all([
        api.getWhatsAppConfig(clientId),
        api.getWhatsAppLogs(clientId, 30),
      ]);
      if (configData) {
        setConfig({
          id: configData.id,
          phoneNumberId: configData.phoneNumberId,
          instanceId: configData.instanceId,
          isOpenAIEnabled: configData.isOpenAIEnabled ?? true,
          aiPersonality:
            configData.aiPersonality ||
            'Eres un asistente amable y profesional de un negocio de belleza. Tu objetivo es ayudar a los clientes con información y reservar citas.',
          isActive: configData.isActive ?? false,
        });
      }
      setLogs(logsData.logs || []);
      await refreshConnection();
    } catch (error) {
      console.error('Error loading WhatsApp data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (clientId) {
      loadData();
      api.getClient(clientId).then((c) => setClientPlan(c.plan)).catch(() => {});
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handleLoadQr() {
    if (!clientId) return;
    setLoadingQr(true);
    setMessage('');
    try {
      const data = await api.getWhatsAppQR(clientId);
      if (data.connected) {
        setConnectionStatus('connected');
        setQrCode(null);
        setMessage('WhatsApp ya está conectado');
        return;
      }

      const raw = data.qrCode || '';
      const src =
        raw.startsWith('data:') || raw.startsWith('http')
          ? raw
          : `data:image/png;base64,${raw}`;
      setQrCode(src);
      setConnectionStatus('disconnected');
      setMessage('Escanea el código QR con WhatsApp en tu teléfono');

      stopPolling();
      pollRef.current = setInterval(() => {
        refreshConnection();
      }, 3000);
    } catch (error: any) {
      setMessage('Error: ' + (error.message || 'No se pudo obtener el QR'));
      setQrCode(null);
    } finally {
      setLoadingQr(false);
    }
  }

  async function handleDisconnect() {
    if (!clientId) return;
    setDisconnecting(true);
    setMessage('');
    try {
      await api.disconnectWhatsApp(clientId);
      setConnectionStatus('disconnected');
      setConfig((prev) => ({ ...prev, isActive: false }));
      setQrCode(null);
      setMessage('WhatsApp desconectado');
      stopPolling();
    } catch (error: any) {
      setMessage('Error: ' + error.message);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSaveAi() {
    if (!clientId) return;
    setSaving(true);
    setMessage('');
    try {
      await api.updateWhatsAppConfig(clientId, {
        isOpenAIEnabled: config.isOpenAIEnabled,
        aiPersonality: config.aiPersonality,
      });
      setMessage('Configuración de IA guardada');
      loadData();
    } catch (error: any) {
      setMessage('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestMessage() {
    if (!clientId || !testPhone || !testMessage) return;
    setSendingTest(true);
    try {
      await api.sendWhatsAppTest(clientId, testPhone, testMessage);
      setMessage('Mensaje de prueba enviado');
      setTestMessage('');
      const logsData = await api.getWhatsAppLogs(clientId, 30);
      setLogs(logsData.logs || []);
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
          <p className="font-body-md text-body-md text-on-surface-variant">
            Conecta WhatsApp con IA para atender citas automáticamente
          </p>
        </div>
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm text-center py-16">
          <div className="w-16 h-16 bg-tertiary-container rounded-full flex items-center justify-center mx-auto mb-lg">
            <span className="material-symbols-outlined text-3xl text-on-tertiary-container">lock</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">
            Función exclusiva del plan Business
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant mb-lg max-w-md mx-auto">
            WhatsApp con IA solo está disponible en el plan Business. Actualiza tu plan para conectar tu número
            escaneando un código QR.
          </p>
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold">
            <span className="material-symbols-outlined">upgrade</span>
            Plan actual: {clientPlan}
          </div>
        </div>
      </div>
    );
  }

  const isConnected = connectionStatus === 'connected';

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">WhatsApp Business</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Conecta tu WhatsApp escaneando un código QR. Sin configurar servidores.
          </p>
        </div>
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            isConnected
              ? 'bg-secondary-container/30 text-on-secondary-container'
              : connectionStatus === 'disconnected'
                ? 'bg-error-container/30 text-on-error-container'
                : 'bg-surface-container-high text-on-surface-variant'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? 'bg-secondary'
                : connectionStatus === 'disconnected'
                  ? 'bg-error'
                  : 'bg-on-surface-variant'
            }`}
          />
          <span className="font-label-md text-label-md">
            {isConnected
              ? 'Conectado'
              : connectionStatus === 'disconnected'
                ? 'Desconectado'
                : 'Estado desconocido'}
          </span>
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
        {/* Conexión QR */}
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">qr_code_2</span>
            Conectar WhatsApp
          </h3>

          {isConnected ? (
            <div className="text-center space-y-lg py-md">
              <div className="w-16 h-16 bg-secondary-container rounded-full flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl text-on-secondary-container">
                  check_circle
                </span>
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface mb-xs">Tu WhatsApp está conectado</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  El asistente puede recibir y responder mensajes de tus clientes.
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-md py-2.5 rounded-lg font-label-md text-label-md font-bold bg-error-container text-on-error-container hover:bg-error/20 disabled:opacity-50 transition-all"
              >
                {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          ) : (
            <div className="space-y-lg">
              <ol className="space-y-md text-on-surface-variant">
                <li className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 font-bold text-sm">
                    1
                  </span>
                  <p className="font-body-sm text-body-sm pt-1">
                    Pulsa <strong className="text-on-surface">Mostrar código QR</strong>
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 font-bold text-sm">
                    2
                  </span>
                  <p className="font-body-sm text-body-sm pt-1">
                    En el teléfono: WhatsApp → Dispositivos vinculados → Vincular dispositivo
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 font-bold text-sm">
                    3
                  </span>
                  <p className="font-body-sm text-body-sm pt-1">Escanea el código. La conexión se detecta sola.</p>
                </li>
              </ol>

              {qrCode ? (
                <div className="flex flex-col items-center gap-md">
                  <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCode} alt="Código QR de WhatsApp" className="w-56 h-56 object-contain" />
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
                    Esperando escaneo… se actualizará automáticamente
                  </p>
                  <button
                    onClick={handleLoadQr}
                    disabled={loadingQr}
                    className="font-label-md text-label-md text-primary hover:underline disabled:opacity-50"
                  >
                    {loadingQr ? 'Actualizando…' : 'Actualizar QR'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLoadQr}
                  disabled={loadingQr}
                  className="w-full py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">qr_code_scanner</span>
                  {loadingQr ? 'Generando QR…' : 'Mostrar código QR'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* IA */}
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary">smart_toy</span>
            Asistente con IA
          </h3>
          <div className="space-y-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-label-md text-label-md text-on-surface">Asistente IA habilitado</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Responder mensajes automáticamente con OpenAI
                </p>
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
              <label className="font-label-md text-label-md text-on-surface mb-xs block">
                Personalidad del asistente
              </label>
              <textarea
                value={config.aiPersonality}
                onChange={(e) => setConfig({ ...config, aiPersonality: e.target.value })}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                rows={5}
                placeholder="Instrucciones para el asistente de IA..."
              />
            </div>
            <button
              onClick={handleSaveAi}
              disabled={saving}
              className="w-full py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saving ? 'Guardando…' : 'Guardar IA'}
            </button>
          </div>
        </div>

        {/* Prueba */}
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">send</span>
            Mensaje de prueba
          </h3>
          <div className="space-y-lg">
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">
                Número de WhatsApp
              </label>
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
              disabled={sendingTest || !testPhone || !testMessage || !isConnected}
              className="w-full py-3 bg-secondary text-on-secondary rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-secondary/20 hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {sendingTest ? 'Enviando…' : 'Enviar prueba'}
            </button>
            {!isConnected && (
              <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
                Conecta WhatsApp primero para enviar pruebas
              </p>
            )}
          </div>
        </div>

        {/* Logs */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
            <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">chat</span>
              Historial de conversaciones
            </h3>
          </div>
          <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
            {logs.length === 0 ? (
              <div className="p-lg text-center text-on-surface-variant font-body-sm text-body-sm">
                No hay mensajes aún
              </div>
            ) : (
              <div className="divide-y divide-outline-variant">
                {logs.map((log) => (
                  <div key={log.id} className="p-md hover:bg-surface-container-low/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
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
                          <span className="font-label-sm text-label-sm text-on-surface">{log.phoneNumber}</span>
                          {log.intent && (
                            <span className="px-2 py-0.5 bg-primary-fixed text-on-primary-fixed-variant rounded text-[10px] font-bold uppercase">
                              {log.intent}
                            </span>
                          )}
                          <span className="font-body-sm text-body-sm text-on-surface-variant ml-auto">
                            {new Date(log.createdAt).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                          {log.message}
                        </p>
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
