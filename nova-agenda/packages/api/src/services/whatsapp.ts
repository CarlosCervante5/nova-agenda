import twilio from 'twilio';

export interface TwilioWhatsAppConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export function normalizeE164(phone: string): string {
  const raw = String(phone || '').replace(/^whatsapp:/i, '').trim();
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return '';
  return digits.startsWith('+') ? digits : `+${digits.replace(/\D/g, '')}`;
}

export function toWhatsAppAddress(phone: string): string {
  const e164 = normalizeE164(phone);
  return e164 ? `whatsapp:${e164}` : '';
}

export function fromWhatsAppAddress(address: string): string {
  return normalizeE164(address);
}

export function hasTwilioCredentials(config?: Partial<TwilioWhatsAppConfig> | null): config is TwilioWhatsAppConfig {
  return Boolean(config?.accountSid && config?.authToken && config?.fromNumber);
}

class WhatsAppService {
  private client(config: TwilioWhatsAppConfig) {
    return twilio(config.accountSid, config.authToken);
  }

  async sendMessage(to: string, message: string, config?: TwilioWhatsAppConfig | null): Promise<boolean> {
    if (!hasTwilioCredentials(config)) {
      console.error('[WhatsApp] Faltan credenciales de Twilio');
      return false;
    }
    const dest = toWhatsAppAddress(to);
    const from = toWhatsAppAddress(config.fromNumber);
    if (!dest || !from) {
      console.error('[WhatsApp] Número origen o destino inválido');
      return false;
    }

    try {
      const result = await this.client(config).messages.create({
        from,
        to: dest,
        body: message,
      });
      console.log(`[WhatsApp] Enviado a ${dest}: ${result.sid}`);
      return true;
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('[WhatsApp] Error enviando mensaje:', err.message || error);
      return false;
    }
  }

  async checkConnection(config?: TwilioWhatsAppConfig | null): Promise<boolean> {
    if (!hasTwilioCredentials(config)) return false;
    try {
      const account = await this.client(config).api.accounts(config.accountSid).fetch();
      return account.status === 'active';
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('[WhatsApp] Error verificando Twilio:', err.message || error);
      return false;
    }
  }

  validateWebhookSignature(authToken: string, signature: string, url: string, params: Record<string, string>): boolean {
    if (!authToken || !signature || !url) return false;
    try {
      return twilio.validateRequest(authToken, signature, url, params);
    } catch {
      return false;
    }
  }
}

export const whatsappService = new WhatsAppService();
