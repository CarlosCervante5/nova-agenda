import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import UsersSettingsTab from '../components/settings/UsersSettingsTab';
import MailSettingsTab from '../components/settings/MailSettingsTab';

const defaultMailTemplates = {
  confirmation_subject: 'Solicitud de cita recibida - {business_name}',
  confirmation_heading: 'Se ha creado tu solicitud de cita',
  confirmation_subheading: 'En breve confirmaremos tu cita',
  confirmation_greeting: 'Hola {client_name},',
  confirmation_intro: 'Hemos recibido tu solicitud. Estos son los detalles:',
  confirmation_contact_title: '¿Necesitas cambiar o cancelar tu cita?',
  confirmation_contact_text: 'Escríbenos por WhatsApp al {whatsapp}.',
  confirmation_whatsapp_button: 'Contactar por WhatsApp',
  admin_subject: 'Nueva cita de {client_name}',
  admin_heading: 'Nueva cita de {client_name}',
  professional_subject: 'Nueva cita en tu agenda - {client_name}',
  professional_heading: 'Nueva cita asignada a ti',
  professional_status_subject: 'Cita {status_label}: {client_name}',
  professional_status_heading: 'Actualización de cita en tu agenda',
  professional_status_message: 'La cita de {client_name} cambió a {status_label}.',
  reminder_subject: 'Recordatorio: tu cita es mañana - {business_name}',
  reminder_heading: 'Tu cita es mañana',
  reminder_message: 'Hola {client_name}, te recordamos que tienes cita mañana. Estos son los detalles:',
  reminder_professional_subject: 'Recordatorio: cita mañana con {client_name}',
  reminder_professional_heading: 'Tienes una cita mañana',
  reminder_professional_message: 'Mañana atenderás a {client_name}. Revisa los detalles de la cita:',
  confirmed_subject: 'Tu cita ha sido confirmada - {business_name}',
  confirmed_heading: 'Cita confirmada',
  confirmed_message: 'Hola {client_name}, te confirmamos que tu cita quedó confirmada.',
  cancelled_subject: 'Tu cita ha sido cancelada - {business_name}',
  cancelled_heading: 'Cita cancelada',
  cancelled_message: 'Hola {client_name}, tu cita ha sido cancelada. Si deseas reagendar, contáctanos por WhatsApp.',
  completed_subject: 'Gracias por tu visita - {business_name}',
  completed_heading: 'Cita completada',
  completed_message: 'Hola {client_name}, gracias por asistir a tu cita. Esperamos verte pronto.',
};

const defaultSettings = {
  contact: {
    business_name: '',
    website_url: '',
    whatsapp_number: '',
    whatsapp_display: '',
    contact_phone: '',
    contact_email: '',
    home_button_label: '',
  },
  mail: {
    mail_enabled: true,
    admin_email: '',
    send_admin_notification: true,
    send_professional_notification: true,
    send_reminder_emails: true,
    notify_status_confirmed: true,
    notify_status_cancelled: true,
    notify_status_completed: false,
  },
  mail_templates: defaultMailTemplates,
  google_calendar: {
    google_calendar_enabled: false,
    google_calendar_id: 'primary',
    google_sync_on_booking: true,
    google_oauth_configured: false,
    google_refresh_token_set: false,
    google_connected: false,
    redirect_uri: '',
    scope: '',
  },
};

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState(defaultSettings);
  const [activeTab, setActiveTab] = useState('contact');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [loadingGoogleCalendars, setLoadingGoogleCalendars] = useState(false);
  const [googleCalendars, setGoogleCalendars] = useState([]);
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    const googleStatus = searchParams.get('google');
    const googleMessage = searchParams.get('message');

    if (tab) {
      setActiveTab(tab);
    }

    if (googleStatus === 'connected') {
      setActiveTab('google_calendar');
      setMessage(decodeURIComponent(googleMessage || '') || 'Google Calendar conectado correctamente');
      loadSettings();
    } else if (googleStatus === 'error') {
      setActiveTab('google_calendar');
      setMessage(decodeURIComponent(googleMessage || '') || 'Error al conectar Google Calendar');
    }

    if (tab || googleStatus) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (activeTab === 'google_calendar' && settings.google_calendar.google_connected) {
      loadGoogleCalendars();
    }
  }, [activeTab, settings.google_calendar.google_connected]);

  const loadGoogleCalendars = async () => {
    if (!settings.google_calendar.google_connected) return;
    setLoadingGoogleCalendars(true);
    try {
      const res = await api.get('/settings/google-calendar/calendars');
      setGoogleCalendars(res.data.calendars || []);
    } catch {
      setGoogleCalendars([]);
    } finally {
      setLoadingGoogleCalendars(false);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      setSettings({
        contact: { ...defaultSettings.contact, ...res.data.contact },
        mail: { ...defaultSettings.mail, ...res.data.mail },
        mail_templates: { ...defaultMailTemplates, ...res.data.mail_templates },
        google_calendar: {
          ...defaultSettings.google_calendar,
          ...res.data.google_calendar,
        },
      });
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        contact: settings.contact,
        mail: settings.mail,
        mail_templates: settings.mail_templates,
        google_calendar: {
          ...settings.google_calendar,
        },
      };
      const res = await api.put('/settings', payload);
      setSettings({
        contact: { ...defaultSettings.contact, ...res.data.settings.contact },
        mail: { ...defaultSettings.mail, ...res.data.settings.mail },
        mail_templates: { ...defaultMailTemplates, ...res.data.settings.mail_templates },
        google_calendar: {
          ...defaultSettings.google_calendar,
          ...res.data.settings.google_calendar,
        },
      });
      setMessage('Configuración guardada correctamente');
      return true;
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo guardar');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setMessage('');
    try {
      await handleSave();
      const res = await api.post('/settings/test-email', { to: testEmail });
      setMessage(res.data.message);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Error al enviar correo de prueba');
    }
  };

  const updateMailTemplate = (field, value) => {
    setSettings(prev => ({
      ...prev,
      mail_templates: { ...prev.mail_templates, [field]: value },
    }));
  };

  const handleTestGoogle = async () => {
    setMessage('');
    try {
      await handleSave();
      const res = await api.post('/settings/test-google-calendar');
      setMessage(res.data.message);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Error al conectar con Google Calendar');
    }
  };

  const handleConnectGoogle = async () => {
    setMessage('');
    const google = settings.google_calendar;

    if (!google.google_oauth_configured) {
      setMessage('Las credenciales OAuth de Google no están configuradas en el servidor.');
      return;
    }

    setConnectingGoogle(true);
    try {
      const res = await api.post('/settings/google-calendar/auth-url');
      window.location.href = res.data.url;
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo iniciar la conexión con Google');
      setConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('¿Desconectar Google Calendar? Las reservas dejarán de sincronizarse hasta volver a conectar.')) {
      return;
    }

    setMessage('');
    try {
      const res = await api.post('/settings/google-calendar/disconnect');
      await loadSettings();
      setMessage(res.data.message || 'Google Calendar desconectado');
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo desconectar Google Calendar');
    }
  };

  const updateContact = (field, value) => {
    setSettings(prev => ({
      ...prev,
      contact: { ...prev.contact, [field]: value },
    }));
  };

  const updateMail = (field, value) => {
    setSettings(prev => ({
      ...prev,
      mail: { ...prev.mail, [field]: value },
    }));
  };

  const updateGoogle = (field, value) => {
    setSettings(prev => ({
      ...prev,
      google_calendar: { ...prev.google_calendar, [field]: value },
    }));
  };

  const tabs = [
    { id: 'contact', label: 'Contacto', icon: 'contact_phone' },
    { id: 'mail', label: 'Plantillas de correo', icon: 'mail' },
    { id: 'google_calendar', label: 'Google Calendar', icon: 'event' },
    { id: 'users', label: 'Usuarios', icon: 'group' },
  ];

  if (loading) {
    return <div className="card" style={{ padding: '48px', textAlign: 'center' }}>Cargando configuración...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Configuración</h1>
          <p className="subtitle">Contacto, correos, Google Calendar y usuarios del sistema.</p>
        </div>
        {activeTab !== 'users' && (
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
        )}
      </div>

      {message && (
        <div className="card" style={{
          marginBottom: '20px',
          padding: '14px 18px',
          background: message.includes('Error') || message.includes('No se') ? '#ffdad6' : 'var(--primary-fixed)',
          color: message.includes('Error') || message.includes('No se') ? 'var(--error)' : 'var(--primary)',
        }}>
          {message}
        </div>
      )}

      <div className="settings-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="material-symbols-outlined">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'contact' && (
        <div className="card">
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", marginBottom: '20px' }}>Información de contacto</h3>
          <p style={{ color: 'var(--on-surface-variant)', marginBottom: '24px', fontSize: '14px' }}>
            Estos datos se usan en el booking público, los correos de confirmación y los mensajes de WhatsApp.
          </p>

          <div className="form-group">
            <label>Nombre del negocio</label>
            <input type="text" value={settings.contact.business_name} onChange={(e) => updateContact('business_name', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>WhatsApp (número completo)</label>
              <input type="text" value={settings.contact.whatsapp_number} onChange={(e) => updateContact('whatsapp_number', e.target.value)} placeholder="527713793868" />
            </div>
            <div className="form-group">
              <label>WhatsApp (texto visible)</label>
              <input type="text" value={settings.contact.whatsapp_display} onChange={(e) => updateContact('whatsapp_display', e.target.value)} placeholder="771.379.3868" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Teléfono de contacto</label>
              <input type="text" value={settings.contact.contact_phone} onChange={(e) => updateContact('contact_phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Correo de contacto</label>
              <input type="email" value={settings.contact.contact_email} onChange={(e) => updateContact('contact_email', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>URL del sitio web</label>
              <input type="url" value={settings.contact.website_url} onChange={(e) => updateContact('website_url', e.target.value)} placeholder="https://tapaicentro.com/" />
            </div>
            <div className="form-group">
              <label>Texto botón inicio</label>
              <input type="text" value={settings.contact.home_button_label} onChange={(e) => updateContact('home_button_label', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'mail' && (
        <MailSettingsTab
          settings={settings}
          testEmail={testEmail}
          onTestEmailChange={setTestEmail}
          onTestEmail={handleTestEmail}
          updateMail={updateMail}
          updateMailTemplate={updateMailTemplate}
        />
      )}

      {activeTab === 'google_calendar' && (
        <div className="card">
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", marginBottom: '20px' }}>Google Calendar</h3>
          <p style={{ color: 'var(--on-surface-variant)', marginBottom: '24px', fontSize: '14px' }}>
            Conecta tu cuenta de Google para crear eventos automáticamente cuando llegue una reserva.
          </p>

          <div className={`google-connection-status ${settings.google_calendar.google_connected ? 'is-connected' : 'is-disconnected'}`}>
            <span className="material-symbols-outlined">
              {settings.google_calendar.google_connected ? 'link' : 'link_off'}
            </span>
            <div>
              <strong>{settings.google_calendar.google_connected ? 'Cuenta conectada' : 'Sin conexión'}</strong>
              <p>
                {settings.google_calendar.google_connected
                  ? 'La cuenta está autorizada. El calendario se detecta al conectar y puedes cambiarlo abajo.'
                  : settings.google_calendar.google_oauth_configured
                    ? 'Pulsa Conectar con Google para autorizar tu cuenta. El Calendar ID se detectará solo.'
                    : 'Faltan credenciales OAuth en el servidor (google.php).'}
              </p>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.google_calendar.google_calendar_enabled} onChange={(e) => updateGoogle('google_calendar_enabled', e.target.checked)} />
            Activar integración
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.google_calendar.google_sync_on_booking} onChange={(e) => updateGoogle('google_sync_on_booking', e.target.checked)} />
            Crear evento al recibir una reserva online
          </label>

          <div className="form-group">
            <label>Calendar ID</label>
            {settings.google_calendar.google_connected && googleCalendars.length > 0 ? (
              <select
                value={settings.google_calendar.google_calendar_id}
                onChange={(e) => updateGoogle('google_calendar_id', e.target.value)}
              >
                {googleCalendars.map(calendar => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.summary}{calendar.primary ? ' (principal)' : ''} — {calendar.id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={settings.google_calendar.google_calendar_id}
                onChange={(e) => updateGoogle('google_calendar_id', e.target.value)}
                placeholder="Se detectará al conectar (normalmente primary)"
              />
            )}
            <small style={{ color: 'var(--on-surface-variant)' }}>
              Se detecta al conectar. Puedes elegir otro calendario después si lo necesitas.
            </small>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <button type="button" className="btn btn-primary" onClick={handleConnectGoogle} disabled={connectingGoogle}>
              {connectingGoogle ? 'Redirigiendo a Google...' : settings.google_calendar.google_connected ? 'Reconectar con Google' : 'Conectar con Google'}
            </button>
            {settings.google_calendar.google_connected && (
              <>
                <button type="button" className="btn btn-secondary" onClick={handleDisconnectGoogle}>
                  Desconectar
                </button>
                <button type="button" className="btn btn-secondary" onClick={loadGoogleCalendars} disabled={loadingGoogleCalendars}>
                  {loadingGoogleCalendars ? 'Cargando calendarios...' : 'Actualizar calendarios'}
                </button>
              </>
            )}
            <button type="button" className="btn btn-secondary" onClick={handleTestGoogle}>
              Probar conexión
            </button>
          </div>

          <div style={{ background: 'var(--surface-container-low)', borderRadius: '0.75rem', padding: '16px', marginBottom: '24px', fontSize: '13px', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
            <strong>Configuración en Google Cloud Console:</strong>
            <ol style={{ margin: '10px 0 0 18px' }}>
              <li>Crea un proyecto y habilita Google Calendar API.</li>
              <li>Crea credenciales OAuth 2.0 de tipo <strong>Aplicación web</strong>.</li>
              <li>El Client ID y Secret van en el servidor (<code>api/config/google.php</code>), no en este panel.</li>
              <li>Agrega esta URI de redirección autorizada:</li>
            </ol>
            <code style={{ display: 'block', marginTop: '12px', padding: '10px 12px', background: '#fff', borderRadius: '0.625rem', wordBreak: 'break-all' }}>
              {settings.google_calendar.redirect_uri || 'https://tapaicentro.com/booking/api/settings/google-calendar/callback'}
            </code>
            <p style={{ marginTop: '12px', marginBottom: 0 }}>
              Scope requerido: <code>{settings.google_calendar.scope || 'https://www.googleapis.com/auth/calendar'}</code>
            </p>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <UsersSettingsTab />
      )}
    </div>
  );
}
