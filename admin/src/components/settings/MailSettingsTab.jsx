import { useState } from 'react';
import MailTemplatePreview from './MailTemplatePreview';

const STATUS_MAIL_SECTIONS = [
  { key: 'confirmed', title: 'Cita confirmada', notifyKey: 'notify_status_confirmed', icon: 'check_circle' },
  { key: 'cancelled', title: 'Cita cancelada', notifyKey: 'notify_status_cancelled', icon: 'cancel' },
  { key: 'completed', title: 'Cita completada', notifyKey: 'notify_status_completed', icon: 'task_alt' },
];

function MailAccordion({ id, title, icon, open, onToggle, children }) {
  return (
    <div className={`mail-accordion ${open ? 'is-open' : ''}`}>
      <button type="button" className="mail-accordion-trigger" onClick={() => onToggle(id)}>
        <span className="mail-accordion-trigger-main">
          <span className="material-symbols-outlined">{icon}</span>
          {title}
        </span>
        <span className="material-symbols-outlined mail-accordion-chevron">expand_more</span>
      </button>
      {open && <div className="mail-accordion-panel">{children}</div>}
    </div>
  );
}

export default function MailSettingsTab({
  settings,
  testEmail,
  onTestEmailChange,
  onTestEmail,
  updateMail,
  updateMailTemplate,
}) {
  const [openSection, setOpenSection] = useState('confirmation');

  const toggleSection = (id) => {
    setOpenSection(prev => (prev === id ? '' : id));
  };

  const previewType = !openSection || openSection === 'general' || openSection === 'test'
    ? 'confirmation'
    : openSection;

  return (
    <div className="card mail-settings-card">
      <h3 style={{ fontFamily: "'DM Sans', sans-serif", marginBottom: '20px' }}>Plantillas de correo</h3>
      <p style={{ color: 'var(--on-surface-variant)', marginBottom: '24px', fontSize: '14px' }}>
        Personaliza los textos del correo que recibe el cliente al crear una solicitud de cita, del aviso al administrador y de los cambios de estatus. El servidor SMTP se configura en <code>mail.php</code>.
      </p>

      <div className="mail-settings-layout">
        <div className="mail-settings-editor">
          <MailAccordion
            id="general"
            title="Opciones generales"
            icon="tune"
            open={openSection === 'general'}
            onToggle={toggleSection}
          >
            <label className="mail-checkbox">
              <input type="checkbox" checked={settings.mail.mail_enabled} onChange={(e) => updateMail('mail_enabled', e.target.checked)} />
              Enviar correos de reserva
            </label>
            <label className="mail-checkbox">
              <input type="checkbox" checked={settings.mail.send_admin_notification} onChange={(e) => updateMail('send_admin_notification', e.target.checked)} />
              Enviar aviso al administrador cuando llegue una reserva
            </label>
            <label className="mail-checkbox">
              <input type="checkbox" checked={settings.mail.send_professional_notification} onChange={(e) => updateMail('send_professional_notification', e.target.checked)} />
              Enviar aviso al profesional asignado cuando llegue una reserva o cambie el estatus
            </label>
            <label className="mail-checkbox">
              <input type="checkbox" checked={settings.mail.send_reminder_emails} onChange={(e) => updateMail('send_reminder_emails', e.target.checked)} />
              Enviar recordatorio por correo 1 día antes al paciente y al profesional
            </label>
            <div className="form-group">
              <label>Correo del administrador (avisos)</label>
              <input type="email" value={settings.mail.admin_email} onChange={(e) => updateMail('admin_email', e.target.value)} placeholder="admin@tapaicentro.com" />
            </div>
            <div className="mail-variables-box">
              <strong>Variables disponibles:</strong>
              <p>
                <code>{'{first_name}'}</code>, <code>{'{client_name}'}</code>, <code>{'{business_name}'}</code>, <code>{'{whatsapp}'}</code>, <code>{'{service_name}'}</code>, <code>{'{date}'}</code>, <code>{'{time}'}</code>, <code>{'{duration}'}</code>, <code>{'{price}'}</code>, <code>{'{status_label}'}</code>
              </p>
            </div>
          </MailAccordion>

          <MailAccordion
            id="confirmation"
            title="Solicitud de cita"
            icon="mark_email_read"
            open={openSection === 'confirmation'}
            onToggle={toggleSection}
          >
            <div className="form-group">
              <label>Asunto</label>
              <input type="text" value={settings.mail_templates.confirmation_subject} onChange={(e) => updateMailTemplate('confirmation_subject', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Título principal</label>
              <input type="text" value={settings.mail_templates.confirmation_heading} onChange={(e) => updateMailTemplate('confirmation_heading', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Subtítulo</label>
              <input type="text" value={settings.mail_templates.confirmation_subheading} onChange={(e) => updateMailTemplate('confirmation_subheading', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Saludo</label>
              <input type="text" value={settings.mail_templates.confirmation_greeting} onChange={(e) => updateMailTemplate('confirmation_greeting', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Texto antes de los detalles</label>
              <input type="text" value={settings.mail_templates.confirmation_intro} onChange={(e) => updateMailTemplate('confirmation_intro', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Título bloque de contacto</label>
              <input type="text" value={settings.mail_templates.confirmation_contact_title} onChange={(e) => updateMailTemplate('confirmation_contact_title', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Texto bloque de contacto</label>
              <input type="text" value={settings.mail_templates.confirmation_contact_text} onChange={(e) => updateMailTemplate('confirmation_contact_text', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Texto botón WhatsApp</label>
              <input type="text" value={settings.mail_templates.confirmation_whatsapp_button} onChange={(e) => updateMailTemplate('confirmation_whatsapp_button', e.target.value)} />
            </div>
          </MailAccordion>

          <MailAccordion
            id="admin"
            title="Aviso al administrador"
            icon="notifications"
            open={openSection === 'admin'}
            onToggle={toggleSection}
          >
            <div className="form-group">
              <label>Asunto</label>
              <input type="text" value={settings.mail_templates.admin_subject} onChange={(e) => updateMailTemplate('admin_subject', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Título del correo</label>
              <input type="text" value={settings.mail_templates.admin_heading} onChange={(e) => updateMailTemplate('admin_heading', e.target.value)} />
            </div>
          </MailAccordion>

          <MailAccordion
            id="professional"
            title="Aviso al profesional"
            icon="person"
            open={openSection === 'professional'}
            onToggle={toggleSection}
          >
            <div className="form-group">
              <label>Asunto (nueva reserva)</label>
              <input type="text" value={settings.mail_templates.professional_subject || ''} onChange={(e) => updateMailTemplate('professional_subject', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Título del correo (nueva reserva)</label>
              <input type="text" value={settings.mail_templates.professional_heading || ''} onChange={(e) => updateMailTemplate('professional_heading', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Asunto (cambio de estatus)</label>
              <input type="text" value={settings.mail_templates.professional_status_subject || ''} onChange={(e) => updateMailTemplate('professional_status_subject', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Título (cambio de estatus)</label>
              <input type="text" value={settings.mail_templates.professional_status_heading || ''} onChange={(e) => updateMailTemplate('professional_status_heading', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Mensaje (cambio de estatus)</label>
              <input type="text" value={settings.mail_templates.professional_status_message || ''} onChange={(e) => updateMailTemplate('professional_status_message', e.target.value)} />
            </div>
          </MailAccordion>

          {STATUS_MAIL_SECTIONS.map((section) => (
            <MailAccordion
              key={section.key}
              id={section.key}
              title={section.title}
              icon={section.icon}
              open={openSection === section.key}
              onToggle={toggleSection}
            >
              <label className="mail-checkbox">
                <input
                  type="checkbox"
                  checked={!!settings.mail[section.notifyKey]}
                  onChange={(e) => updateMail(section.notifyKey, e.target.checked)}
                />
                Enviar correo cuando la cita pase a <strong>{section.title.toLowerCase()}</strong>
              </label>
              <div className="form-group">
                <label>Asunto</label>
                <input type="text" value={settings.mail_templates[`${section.key}_subject`] || ''} onChange={(e) => updateMailTemplate(`${section.key}_subject`, e.target.value)} />
              </div>
              <div className="form-group">
                <label>Título principal</label>
                <input type="text" value={settings.mail_templates[`${section.key}_heading`] || ''} onChange={(e) => updateMailTemplate(`${section.key}_heading`, e.target.value)} />
              </div>
              <div className="form-group">
                <label>Mensaje</label>
                <input type="text" value={settings.mail_templates[`${section.key}_message`] || ''} onChange={(e) => updateMailTemplate(`${section.key}_message`, e.target.value)} />
              </div>
            </MailAccordion>
          ))}

          <MailAccordion
            id="test"
            title="Enviar prueba"
            icon="send"
            open={openSection === 'test'}
            onToggle={toggleSection}
          >
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', marginBottom: '16px' }}>
              Envía un correo de prueba con la plantilla de solicitud de cita al email que indiques.
            </p>
            <div className="mail-test-row">
              <input type="email" value={testEmail} onChange={(e) => onTestEmailChange(e.target.value)} placeholder="correo@ejemplo.com" />
              <button type="button" className="btn btn-secondary" onClick={onTestEmail}>Enviar prueba</button>
            </div>
          </MailAccordion>
        </div>

        <div className="mail-settings-preview">
          <MailTemplatePreview
            previewType={previewType}
            templates={settings.mail_templates}
            contact={settings.contact}
          />
        </div>
      </div>
    </div>
  );
}
