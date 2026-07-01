import { renderMailTemplate, getMailPreviewVars, STATUS_MAIL_THEMES, getPreviewSubject } from '../../utils/mailPreview';
import { getStatusLabel } from '../../utils/labels';

const LOGO_URL = `${import.meta.env.BASE_URL}tapai_logo.png`;

function DetailRow({ label, value, accent }) {
  return (
    <div className="mail-preview-detail-row">
      <span>{label}</span>
      <strong style={accent ? { color: accent } : undefined}>{value}</strong>
    </div>
  );
}

function ConfirmationPreview({ templates, vars }) {
  const whatsapp = vars.whatsapp;
  const hasWhatsapp = Boolean(whatsapp);

  return (
    <>
      <div className="mail-preview-header" style={{ background: 'linear-gradient(135deg, #7d7f3e, #aaa66a)' }}>
        <h4>{renderMailTemplate(templates.confirmation_heading, vars)}</h4>
        <p>{renderMailTemplate(templates.confirmation_subheading, vars)}</p>
      </div>
      <div className="mail-preview-body">
        <p>{renderMailTemplate(templates.confirmation_greeting, vars)}</p>
        <p className="mail-preview-muted">{renderMailTemplate(templates.confirmation_intro, vars)}</p>
        <div className="mail-preview-details">
          <DetailRow label="Servicio" value={vars.service_name} />
          <DetailRow label="Fecha" value={vars.date} />
          <DetailRow label="Hora" value={vars.time} />
          <DetailRow label="Duración" value={`${vars.duration} min`} />
          <DetailRow label="Precio" value={vars.price} accent="#7d7f3e" />
          {hasWhatsapp && (
            <DetailRow label="WhatsApp" value={whatsapp} accent="#7d7f3e" />
          )}
        </div>
        {hasWhatsapp ? (
          <div className="mail-preview-contact-block">
            <strong>{renderMailTemplate(templates.confirmation_contact_title, vars)}</strong>
            <p>{renderMailTemplate(templates.confirmation_contact_text, vars)}</p>
            <span className="mail-preview-whatsapp-btn">
              {renderMailTemplate(templates.confirmation_whatsapp_button, vars)}
            </span>
          </div>
        ) : (
          <p className="mail-preview-muted">
            Si necesitas hacer cambios o cancelar tu cita, contáctanos directamente con <strong>{vars.business_name}</strong>.
          </p>
        )}
      </div>
    </>
  );
}

function AdminPreview({ templates, vars }) {
  return (
    <>
      <div className="mail-preview-body mail-preview-body--admin">
        <h4 style={{ color: '#7d7f3e', margin: '0 0 16px' }}>
          {renderMailTemplate(templates.admin_heading, vars)}
        </h4>
        <p><strong>Cliente:</strong> {vars.client_name}</p>
        <p><strong>Email:</strong> maria@ejemplo.com</p>
        <p><strong>Teléfono:</strong> 771 123 4567</p>
        <p><strong>Servicio:</strong> {vars.service_name}</p>
        <p><strong>Fecha:</strong> {vars.date}</p>
        <p><strong>Hora:</strong> {vars.time}</p>
      </div>
    </>
  );
}

function StatusPreview({ previewType, templates, vars }) {
  const theme = STATUS_MAIL_THEMES[previewType] || STATUS_MAIL_THEMES.confirmed;
  const statusVars = {
    ...vars,
    status: previewType,
    status_label: getStatusLabel(previewType),
  };
  const hasWhatsapp = Boolean(vars.whatsapp);

  return (
    <>
      <div
        className="mail-preview-header"
        style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}
      >
        <h4>{renderMailTemplate(templates[`${previewType}_heading`], statusVars)}</h4>
        <p>Estatus: {statusVars.status_label}</p>
      </div>
      <div className="mail-preview-body">
        <p className="mail-preview-muted">
          {renderMailTemplate(templates[`${previewType}_message`], statusVars)}
        </p>
        <div className="mail-preview-details">
          <DetailRow label="Servicio" value={vars.service_name} />
          <DetailRow label="Fecha" value={vars.date} />
          <DetailRow label="Hora" value={vars.time} />
          <DetailRow label="Duración" value={`${vars.duration} min`} />
          <DetailRow label="Precio" value={vars.price} accent={theme.from} />
        </div>
        {previewType === 'cancelled' && hasWhatsapp && (
          <p className="mail-preview-muted">
            Si deseas reagendar, escríbenos por WhatsApp al <strong style={{ color: theme.from }}>{vars.whatsapp}</strong>.
          </p>
        )}
      </div>
    </>
  );
}

export default function MailTemplatePreview({ previewType, templates, contact }) {
  const vars = getMailPreviewVars(contact);
  const subject = getPreviewSubject(previewType, templates, vars);

  return (
    <div className="mail-preview-panel">
      <div className="mail-preview-panel-head">
        <span className="material-symbols-outlined">mail</span>
        <div>
          <strong>Vista previa</strong>
          <p>Asunto: {subject}</p>
        </div>
      </div>
      <div className="mail-preview-frame">
        <div className="mail-preview-canvas">
          <div className="mail-preview-logo">
            <img src={LOGO_URL} alt={vars.business_name} />
          </div>
          {previewType === 'confirmation' && (
            <ConfirmationPreview templates={templates} vars={vars} />
          )}
          {previewType === 'admin' && (
            <AdminPreview templates={templates} vars={vars} />
          )}
          {['confirmed', 'cancelled', 'completed'].includes(previewType) && (
            <StatusPreview previewType={previewType} templates={templates} vars={vars} />
          )}
          <div className="mail-preview-footer">
            {vars.business_name} · {vars.website_url}
          </div>
        </div>
      </div>
    </div>
  );
}
