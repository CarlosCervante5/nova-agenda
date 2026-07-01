import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type Intent = 'BOOKING' | 'CANCEL' | 'CONFIRM' | 'INFO' | 'GREETING' | 'UNKNOWN';

export interface ParsedIntent {
  intent: Intent;
  response: string;
  data?: {
    serviceName?: string;
    date?: string;
    time?: string;
    customerName?: string;
  };
}

interface ServiceInfo {
  name: string;
  description?: string | null;
  duration: number;
  price?: number | null;
}

interface WorkingHoursInfo {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}

interface ExistingBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  serviceName: string;
}

class OpenAIService {
  private client: OpenAI | null = null;
  private apiKey: string | null = null;

  private async getClient(): Promise<OpenAI> {
    // Get API key from platform config
    if (!this.apiKey) {
      const config = await prisma.platformConfig.findUnique({
        where: { key: 'openai_api_key' },
      });
      this.apiKey = config?.value || process.env.OPENAI_API_KEY || '';
    }

    if (!this.client || this.apiKey !== this.client.apiKey) {
      this.client = new OpenAI({ apiKey: this.apiKey });
    }

    return this.client;
  }

  private async getModel(): Promise<string> {
    const config = await prisma.platformConfig.findUnique({
      where: { key: 'openai_model' },
    });
    return config?.value || 'gpt-4o';
  }

  private async getMaxTokens(): Promise<number> {
    const config = await prisma.platformConfig.findUnique({
      where: { key: 'openai_max_tokens' },
    });
    return parseInt(config?.value || '500');
  }

  async reloadApiKey(): Promise<void> {
    const config = await prisma.platformConfig.findUnique({
      where: { key: 'openai_api_key' },
    });
    this.apiKey = config?.value || process.env.OPENAI_API_KEY || '';
    this.client = null;
  }

  async analyzeMessage(
    message: string,
    businessName: string,
    services: ServiceInfo[],
    workingHours: WorkingHoursInfo[],
    existingBookings: ExistingBooking[],
    customPrompt?: string
  ): Promise<ParsedIntent> {
    const systemPrompt = this.buildSystemPrompt(
      businessName,
      services,
      workingHours,
      existingBookings,
      customPrompt
    );

    try {
      const client = await this.getClient();
      const model = await this.getModel();
      const maxTokens = await this.getMaxTokens();

      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return {
          intent: 'UNKNOWN',
          response: 'Lo siento, no pude procesar tu mensaje. Por favor, intenta de nuevo.',
        };
      }

      const parsed = JSON.parse(content);
      return {
        intent: parsed.intent || 'UNKNOWN',
        response: parsed.response || 'No pude entender tu solicitud.',
        data: parsed.data || undefined,
      };
    } catch (error: any) {
      console.error('[OpenAI] Error analizando mensaje:', error.message);
      return {
        intent: 'UNKNOWN',
        response: 'Disculpa, estoy teniendo problemas técnicos. Por favor, intenta de nuevo en un momento.',
      };
    }
  }

  async generateReminderMessage(
    businessName: string,
    customerName: string,
    serviceName: string,
    date: string,
    time: string
  ): Promise<string> {
    try {
      const client = await this.getClient();
      const model = await this.getModel();

      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `Eres un asistente de ${businessName}. Genera un recordatorio amigable y profesional para una cita. Sé breve y cálido. Incluye los detalles de la cita.`,
          },
          {
            role: 'user',
            content: `Genera un recordatorio para: Cliente: ${customerName}, Servicio: ${serviceName}, Fecha: ${date}, Hora: ${time}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 200,
      });

      return completion.choices[0]?.message?.content ||
        `Hola ${customerName}, te recordamos tu cita de ${serviceName} el ${date} a las ${time}. ¡Te esperamos!`;
    } catch (error) {
      return `Hola ${customerName}, te recordamos tu cita de ${serviceName} el ${date} a las ${time}. ¡Te esperamos en ${businessName}!`;
    }
  }

  async generateFollowUpMessage(
    businessName: string,
    customerName: string,
    serviceName: string
  ): Promise<string> {
    try {
      const client = await this.getClient();
      const model = await this.getModel();

      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `Eres un asistente de ${businessName}. Genera un mensaje de seguimiento post-cita. Agradece al cliente, pregunta si quedó satisfecho y invita a reservar de nuevo. Sé breve y amable.`,
          },
          {
            role: 'user',
            content: `Genera seguimiento para: Cliente: ${customerName}, Servicio recibido: ${serviceName}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 200,
      });

      return completion.choices[0]?.message?.content ||
        `Hola ${customerName}, ¡esperamos que haya disfrutado tu ${serviceName}! Si tienes alguna pregunta o quieres reservar de nuevo, escríbenos. ¡Gracias por confiar en ${businessName}!`;
    } catch (error) {
      return `Hola ${customerName}, ¡esperamos que haya disfrutado tu ${serviceName}! Si tienes alguna pregunta o quieres reservar de nuevo, escríbenos. ¡Gracias por confiar en ${businessName}!`;
    }
  }

  private buildSystemPrompt(
    businessName: string,
    services: ServiceInfo[],
    workingHours: WorkingHoursInfo[],
    existingBookings: ExistingBooking[],
    customPrompt?: string
  ): string {
    const servicesList = services
      .map(s => `- ${s.name}: ${s.duration} minutos, ${s.price ? `$${s.price}` : 'Gratis'}${s.description ? ` (${s.description})` : ''}`)
      .join('\n');

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const hoursList = workingHours
      .map(wh => `- ${dayNames[wh.dayOfWeek]}: ${wh.isOpen ? `${wh.openTime} - ${wh.closeTime}` : 'Cerrado'}`)
      .join('\n');

    const bookingsList = existingBookings.length > 0
      ? existingBookings
          .map(b => `- ${b.serviceName} el ${b.date} a las ${b.startTime} (${b.status})`)
          .join('\n')
      : 'No hay citas existentes.';

    return `Eres un asistente de WhatsApp para el negocio "${businessName}".

SERVICIOS DISPONIBLES:
${servicesList}

HORARIO DE ATENCIÓN:
${hoursList}

CITAS EXISTENTES DEL CLIENTE:
${bookingsList}

INSTRUCCIONES:
1. Responde de forma amable, profesional y breve (máximo 2-3 oraciones por respuesta).
2. Detecta la intención del mensaje y responde con JSON en este formato exacto:
{
  "intent": "BOOKING|CANCEL|CONFIRM|INFO|GREETING|UNKNOWN",
  "response": "Tu respuesta al cliente aquí",
  "data": {
    "serviceName": "nombre del servicio si aplica",
    "date": "YYYY-MM-DD si aplica",
    "time": "HH:MM si aplica",
    "customerName": "nombre del cliente si lo menciona"
  }
}

REGLAS PARA CADA INTENCIÓN:
- BOOKING: Cuando el cliente quiera agendar una cita. Extrae servicio, fecha y hora si los menciona. Si faltan datos, pregunta por ellos.
- CANCEL: Cuando el cliente quiera cancelar una cita existente.
- CONFIRM: Cuando el cliente confirme una cita pendiente.
- INFO: Cuando pregunte por horarios, precios, servicios, ubicación, etc.
- GREETING: Saludos y conversación casual.
- UNKNOWN: Cuando no entiendas la intención.

Solo responde el JSON, sin texto adicional.

${customPrompt ? `INSTRUCCIONES ADICIONALES DEL NEGOCIO:\n${customPrompt}` : ''}`;
  }
}

export const openaiService = new OpenAIService();
