import { getStatusLabel } from './labels';

export function renderMailTemplate(template, vars) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? `{${key}}`));
}

export function getMailPreviewVars(contact) {
  const businessName = contact.business_name || 'Tapai Centro de Sanación';
  const whatsapp = contact.whatsapp_display || contact.whatsapp_number || '771.379.3868';
  const websiteUrl = (contact.website_url || 'https://tapaicentro.com/').replace(/\/$/, '');

  return {
    first_name: 'María',
    client_name: 'María López',
    business_name: businessName,
    whatsapp,
    whatsapp_url: whatsapp ? `https://wa.me/${String(contact.whatsapp_number || '527713793868').replace(/\D/g, '')}` : '',
    service_name: 'Masaje terapéutico',
    date: 'lunes 23 de junio de 2026',
    time: '10:00',
    duration: '60',
    price: '$850.00',
    status: 'confirmed',
    status_label: getStatusLabel('confirmed'),
    website_url: websiteUrl,
  };
}

export const STATUS_MAIL_THEMES = {
  confirmed: { from: '#7d7f3e', to: '#aaa66a' },
  cancelled: { from: '#8b5e5e', to: '#b88989' },
  completed: { from: '#5e7d6a', to: '#89b89a' },
};

export function getPreviewSubject(previewType, templates, vars) {
  if (previewType === 'confirmation') {
    return renderMailTemplate(templates.confirmation_subject, vars);
  }
  if (previewType === 'admin') {
    return renderMailTemplate(templates.admin_subject, vars);
  }
  if (['confirmed', 'cancelled', 'completed'].includes(previewType)) {
    return renderMailTemplate(templates[`${previewType}_subject`], {
      ...vars,
      status: previewType,
      status_label: getStatusLabel(previewType),
    });
  }
  return '';
}
