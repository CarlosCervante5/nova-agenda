export const ADDON_OPTIONS = [
  {
    key: 'WHATSAPP_AI',
    name: 'WhatsApp con IA + Chatbot',
    price: 499,
    description: 'Chatbot con IA 24/7 y reserva de citas por WhatsApp (Twilio).',
    icon: 'smart_toy',
  },
  {
    key: 'POS',
    name: 'Punto de venta',
    price: 199,
    description: 'Caja, ventas y cobros del negocio desde el panel.',
    icon: 'point_of_sale',
  },
] as const;

export function hasAddon(addons: string[] | undefined, key: string) {
  return (addons || []).includes(key);
}
