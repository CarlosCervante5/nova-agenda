import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface WhatsAppMessage {
  to: string;
  message: string;
}

export interface WhatsAppConfig {
  phoneNumberId: string;
  apiKey: string;
  instanceId?: string;
}

class WhatsAppService {
  private async getGlobalConfig(): Promise<{ apiUrl: string; apiKey: string; instanceId: string }> {
    const configs = await prisma.platformConfig.findMany({
      where: {
        key: { in: ['evo_cloud_api_url', 'evo_cloud_api_key', 'evo_cloud_instance_id'] },
      },
    });

    const map: Record<string, string> = {};
    configs.forEach(c => { map[c.key] = c.value; });

    return {
      apiUrl: map['evo_cloud_api_url'] || process.env.EVO_CLOUD_API_URL || 'https://api.evo.cloud',
      apiKey: map['evo_cloud_api_key'] || process.env.EVO_CLOUD_API_KEY || '',
      instanceId: map['evo_cloud_instance_id'] || process.env.EVO_CLOUD_INSTANCE_ID || '',
    };
  }

  private async getHeaders(config?: WhatsAppConfig): Promise<Record<string, string>> {
    const global = await this.getGlobalConfig();
    const apiKey = config?.apiKey || global.apiKey;
    return {
      'apikey': apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async getInstanceId(config?: WhatsAppConfig): Promise<string> {
    const global = await this.getGlobalConfig();
    return config?.instanceId || global.instanceId;
  }

  private async getApiUrl(config?: WhatsAppConfig): Promise<string> {
    const global = await this.getGlobalConfig();
    return global.apiUrl;
  }

  async sendMessage(to: string, message: string, config?: WhatsAppConfig): Promise<boolean> {
    try {
      const instanceId = await this.getInstanceId(config);
      const apiUrl = await this.getApiUrl(config);
      const headers = await this.getHeaders(config);
      const url = `${apiUrl}/message/sendText/${instanceId}`;
      
      const payload = {
        number: to,
        text: message,
      };

      console.log(`[WhatsApp] Enviando mensaje a ${to}:`, message.substring(0, 100) + '...');
      
      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Mensaje enviado exitosamente:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error enviando mensaje:`, error.response?.data || error.message);
      return false;
    }
  }

  async sendInteractiveButtons(
    to: string,
    message: string,
    buttons: Array<{ id: string; text: string }>,
    config?: WhatsAppConfig
  ): Promise<boolean> {
    try {
      const instanceId = await this.getInstanceId(config);
      const apiUrl = await this.getApiUrl(config);
      const headers = await this.getHeaders(config);
      const url = `${apiUrl}/message/sendButtons/${instanceId}`;

      const payload = {
        number: to,
        title: '',
        description: message,
        buttons: buttons.map(btn => ({
          buttonId: btn.id,
          buttonText: { displayText: btn.text },
          type: 1,
        })),
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Botones interactivos enviados:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error enviando botones:`, error.response?.data || error.message);
      return false;
    }
  }

  async sendListMenu(
    to: string,
    title: string,
    description: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    config?: WhatsAppConfig
  ): Promise<boolean> {
    try {
      const instanceId = await this.getInstanceId(config);
      const apiUrl = await this.getApiUrl(config);
      const headers = await this.getHeaders(config);
      const url = `${apiUrl}/message/sendList/${instanceId}`;

      const payload = {
        number: to,
        title,
        description,
        buttonText,
        footerText: '',
        sections,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Lista interactiva enviada:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error enviando lista:`, error.response?.data || error.message);
      return false;
    }
  }

  async checkConnection(config?: WhatsAppConfig): Promise<boolean> {
    try {
      const instanceId = await this.getInstanceId(config);
      const apiUrl = await this.getApiUrl(config);
      const headers = await this.getHeaders(config);
      const url = `${apiUrl}/instance/connectionState/${instanceId}`;
      
      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state === 'open';
    } catch (error: any) {
      console.error(`[WhatsApp] Error verificando conexión:`, error.message);
      return false;
    }
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}
  }

  // Get QR code for a specific instance (for client connection)
  async getQRCode(instanceName: string): Promise<{ base64: string; qrCode: string }> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/qrcode/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 15000,
      });

      return {
        base64: response.data?.base64 || '',
        qrCode: response.data?.qrcode || '',
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting QR code:`, error.message);
      throw new Error('No se pudo obtener el código QR');
    }
  }

  // Get connection state for a specific instance
  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/connectionState/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
      });

      return response.data?.state || 'close';
    } catch (error: any) {
      console.error(`[WhatsApp] Error getting connection state:`, error.message);
      return 'close';
    }
  }

  // Create a new instance for a client
  async createInstance(instanceName: string, webhookUrl?: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/create`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      const payload = {
        instanceName,
        qrcode: true,
        webhook_url: webhookUrl || `${global.apiUrl}/webhook`,
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      console.log(`[WhatsApp] Instance created:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error creating instance:`, error.response?.data || error.message);
      return false;
    }
  }

  // Disconnect an instance
  async disconnectInstance(instanceName: string): Promise<boolean> {
    try {
      const global = await this.getGlobalConfig();
      const url = `${global.apiUrl}/instance/logout/${instanceName}`;
      const headers = {
        'apikey': global.apiKey,
        'Content-Type': 'application/json',
      };

      await axios.post(url, {}, {
        headers,
        timeout: 10000,
      });

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp] Error disconnecting instance:`, error.message);
      return false;
    }
  }
}

export const whatsappService = new WhatsAppService();
