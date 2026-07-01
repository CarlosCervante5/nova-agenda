const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  clientId?: string;
  client?: { id: string; name: string; slug: string; primaryColor: string };
}

export interface Client {
  id: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  primaryColor: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  _count?: { users: number; services: number; bookings: number };
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  duration: number;
  price?: number;
  color: string;
  isActive: boolean;
  clientId: string;
  _count?: { bookings: number };
}

export interface Booking {
  id: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  notes?: string;
  service: { name: string; color: string };
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_URL}${path}`, { ...options, headers });

    if (res.status === 401) {
      this.token = null;
      if (typeof window !== 'undefined') localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return res.json();
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') localStorage.removeItem('token');
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() { return this.request<User>('/api/auth/me'); }

  // Clients
  async getClients() { return this.request<Client[]>('/api/clients'); }
  async getClient(id: string) { return this.request<Client>(`/api/clients/${id}`); }
  async createClient(data: Partial<Client>) {
    return this.request<Client>('/api/clients', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateClient(id: string, data: Partial<Client>) {
    return this.request<Client>(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteClient(id: string) {
    return this.request(`/api/clients/${id}`, { method: 'DELETE' });
  }

  // Services
  async getServices(clientId?: string) {
    const params = clientId ? `?clientId=${clientId}` : '';
    return this.request<Service[]>(`/api/services${params}`);
  }
  async createService(data: Partial<Service>) {
    return this.request<Service>('/api/services', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateService(id: string, data: Partial<Service>) {
    return this.request<Service>(`/api/services/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteService(id: string) {
    return this.request(`/api/services/${id}`, { method: 'DELETE' });
  }

  // Bookings
  async getBookings(params?: { date?: string; status?: string; clientId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.date) searchParams.set('date', params.date);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.clientId) searchParams.set('clientId', params.clientId);
    const query = searchParams.toString();
    return this.request<Booking[]>(`/api/bookings${query ? `?${query}` : ''}`);
  }
  async updateBookingStatus(id: string, status: string) {
    return this.request<Booking>(`/api/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }
  async deleteBooking(id: string) {
    return this.request(`/api/bookings/${id}`, { method: 'DELETE' });
  }

  // WhatsApp
  async getWhatsAppConfig(clientId: string) {
    return this.request<any>(`/api/whatsapp/config/${clientId}`);
  }
  async updateWhatsAppConfig(clientId: string, data: any) {
    return this.request<any>(`/api/whatsapp/config/${clientId}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async toggleWhatsApp(clientId: string) {
    return this.request<{ isActive: boolean }>(`/api/whatsapp/config/${clientId}/toggle`, { method: 'PATCH' });
  }
  async getWhatsAppStatus(clientId: string) {
    return this.request<{ connected: boolean; isActive: boolean }>(`/api/whatsapp/config/${clientId}/status`);
  }
  async getWhatsAppLogs(clientId: string, limit = 50, offset = 0) {
    return this.request<{ logs: any[]; total: number }>(`/api/whatsapp/logs/${clientId}?limit=${limit}&offset=${offset}`);
  }
  async sendWhatsAppTest(clientId: string, phone: string, message: string) {
    return this.request<{ sent: boolean }>(`/api/whatsapp/test/${clientId}`, {
      method: 'POST',
      body: JSON.stringify({ phone, message }),
    });
  }

  // Platform Config
  async getPlatformConfig() {
    return this.request<Record<string, Record<string, string>>>('/api/platform-config');
  }
  async getPlatformConfigByCategory(category: string) {
    return this.request<Record<string, string>>(`/api/platform-config/${category}`);
  }
  async updatePlatformConfig(category: string, data: Record<string, string>) {
    return this.request<any>(`/api/platform-config/${category}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Billing / Stripe
  async getPlans() {
    return this.request<{ currentPlan: string; plans: Record<string, { name: string; price: number; features: string[] }>; subscription: any }>('/api/stripe/plans');
  }
  async createCheckoutSession(plan: string) {
    return this.request<{ sessionId: string; url: string }>('/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
  }
  async createPortalSession() {
    return this.request<{ url: string }>('/api/stripe/portal', { method: 'POST' });
  }
}

export const api = new ApiClient();
