import { resolveApiBaseUrl } from './api-base-url';

/** En el navegador usamos rutas relativas; Next.js las proxya a la API vía middleware. */
function getApiBaseUrl() {
  if (typeof window !== 'undefined') return '';
  return resolveApiBaseUrl();
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  clientId?: string;
  client?: { id: string; name: string; slug: string; primaryColor: string; addons?: string[] };
}

export interface Client {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logo?: string | null;
  primaryColor: string;
  tagline?: string | null;
  about?: string | null;
  coverImage?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  whatsappPhone?: string | null;
  websiteEnabled?: boolean;
  /** Espacio entre citas en minutos: 5, 10, 15 o 20 */
  slotGapMinutes?: number;
  bookingFormEnabled?: boolean;
  bookingRequirePhone?: boolean;
  bookingRequireEmail?: boolean;
  bookingShowNotes?: boolean;
  bookingIntroText?: string | null;
  bookingSuccessText?: string | null;
  bookingConfirmAuto?: boolean;
  plan: string;
  isActive: boolean;
  /** Addons contratados, ej: ['WHATSAPP_AI'] */
  addons?: string[];
  createdAt: string;
  _count?: { users: number; services: number; bookings: number };
}

export interface WorkingHoursEntry {
  id?: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
  children?: ServiceCategory[];
  _count?: { services: number; children?: number };
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
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
    color: string;
    parentId?: string | null;
    parent?: { id: string; name: string } | null;
  } | null;
  useCustomHours?: boolean;
  workingHours?: WorkingHoursEntry[];
  _count?: { bookings: number };
}

export interface StaffMember {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  bio?: string | null;
  color: string;
  avatarUrl?: string | null;
  isActive: boolean;
  sortOrder: number;
  clientId: string;
  services?: { serviceId: string; service?: { id: string; name: string; duration: number; color: string } }[];
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
  staff?: { id: string; name: string; color?: string; title?: string | null } | null;
  staffId?: string | null;
  notes?: string;
  service: { name: string; color: string; duration?: number };
}

export interface ClientStripeModeStatus {
  configured: boolean;
  hasSecretKey: boolean;
  hasPublishableKey: boolean;
  hasWebhookSecret: boolean;
}

export interface ClientStripeConfig {
  mode: 'test' | 'live';
  test: ClientStripeModeStatus;
  live: ClientStripeModeStatus;
  configured: boolean;
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  hasSecretKey: boolean;
  hasPublishableKey: boolean;
  hasWebhookSecret: boolean;
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
      res = await fetch(`${getApiBaseUrl()}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('La API no respondió a tiempo. Verifica la conexión o API_URL.');
      }
      throw new Error('No se pudo conectar con la API. Verifica que el servicio esté en línea.');
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.status === 401) {
      this.token = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        const path = window.location.pathname;
        const isAuthPage = path === '/login' || path === '/register' || path === '/admin/login';
        if (!isAuthPage) {
          window.location.href = '/login';
        }
      }
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

  async register(businessName: string, ownerName: string, email: string, password: string) {
    const data = await this.request<{ token: string; user: User; client: { id: string; name: string; slug: string; plan: string } }>('/api/public/register', {
      method: 'POST',
      body: JSON.stringify({ businessName, ownerName, email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() { return this.request<User>('/api/auth/me'); }

  async uploadImage(file: File, kind = 'image') {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const body = new FormData();
    body.append('file', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    let res: Response;
    try {
      res = await fetch(`${getApiBaseUrl()}/api/uploads?kind=${encodeURIComponent(kind)}`, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('La subida tardó demasiado. Intenta con una imagen más ligera.');
      }
      throw new Error('No se pudo subir la imagen.');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'No se pudo subir la imagen' }));
      throw new Error(error.error || 'No se pudo subir la imagen');
    }
    return res.json() as Promise<{ url: string }>;
  }

  // Clients
  async getClients() { return this.request<Client[]>('/api/clients'); }
  async getClient(id: string) { return this.request<Client>(`/api/clients/${id}`); }
  async createClient(data: Partial<Client> & { password?: string; ownerName?: string }) {
    return this.request<Client>('/api/clients', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateClient(id: string, data: Partial<Client> & { password?: string; ownerName?: string }) {
    return this.request<Client>(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async getWorkingHours(clientId: string) {
    return this.request<WorkingHoursEntry[]>(`/api/clients/${clientId}/working-hours`);
  }
  async updateWorkingHours(clientId: string, hours: WorkingHoursEntry[]) {
    return this.request<WorkingHoursEntry[]>(`/api/clients/${clientId}/working-hours`, {
      method: 'PUT',
      body: JSON.stringify({ hours }),
    });
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

  // Service categories (PRO+)
  async getServiceCategories() {
    return this.request<ServiceCategory[]>('/api/service-categories');
  }
  async getServiceCategoriesFlat() {
    return this.request<ServiceCategory[]>('/api/service-categories/flat');
  }
  async createServiceCategory(data: Record<string, unknown>) {
    return this.request<ServiceCategory>('/api/service-categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateServiceCategory(id: string, data: Record<string, unknown>) {
    return this.request<ServiceCategory>(`/api/service-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async deleteServiceCategory(id: string) {
    return this.request(`/api/service-categories/${id}`, { method: 'DELETE' });
  }

  // Staff
  async getStaff(clientId?: string) {
    const params = clientId ? `?clientId=${clientId}` : '';
    return this.request<StaffMember[]>(`/api/staff${params}`);
  }
  async createStaff(data: Record<string, unknown>) {
    return this.request<StaffMember>('/api/staff', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateStaff(id: string, data: Record<string, unknown>) {
    return this.request<StaffMember>(`/api/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async toggleStaff(id: string) {
    return this.request<StaffMember>(`/api/staff/${id}/toggle`, { method: 'PATCH' });
  }
  async deleteStaff(id: string) {
    return this.request(`/api/staff/${id}`, { method: 'DELETE' });
  }

  // Bookings
  async getBookings(params?: { date?: string; dateFrom?: string; dateTo?: string; status?: string; clientId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.date) searchParams.set('date', params.date);
    if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.clientId) searchParams.set('clientId', params.clientId);
    const query = searchParams.toString();
    return this.request<Booking[]>(`/api/bookings${query ? `?${query}` : ''}`);
  }
  async createAdminBooking(data: {
    serviceId: string;
    staffId?: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    date: string;
    startTime: string;
    notes?: string;
    clientId?: string;
  }) {
    return this.request<Booking>('/api/bookings/admin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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
  async getWhatsAppQR(clientId: string) {
    return this.request<{ qrCode: string; instanceName: string; connected: boolean }>(
      `/api/whatsapp/qr/${clientId}`
    );
  }
  async getWhatsAppConnection(clientId: string) {
    return this.request<{
      connected: boolean;
      state: string;
      isActive: boolean;
      phoneNumber?: string;
    }>(`/api/whatsapp/connection/${clientId}`);
  }
  async disconnectWhatsApp(clientId: string) {
    return this.request<{ message: string }>(`/api/whatsapp/disconnect/${clientId}`, {
      method: 'POST',
    });
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
  async getPlans() {    return this.request<{
      currentPlan: string;
      plans: Record<string, { name: string; price: number; features: string[]; isContact?: boolean }>;
      addons?: Record<string, { name: string; price: number; description: string; features: string[] }>;
      clientAddons?: string[];
      subscription: any;
      usage?: {
        services: { used: number; limit: number | null };
        bookingsThisMonth: { used: number; limit: number | null };
        publicBooking: boolean;
      };
      stripeConfigured?: boolean;
      stripeMissing?: string[];
    }>('/api/stripe/plans');
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
  async syncStripeSubscription(sessionId?: string) {
    return this.request<{
      plan: string;
      subscription: {
        id: string;
        status: string;
        currentPeriodEnd: string;
        cancelAt: string | null;
      } | null;
    }>('/api/stripe/sync', {
      method: 'POST',
      body: JSON.stringify(sessionId ? { sessionId } : {}),
    });
  }

  // Configuración de Stripe propia del negocio (para cobrar a sus clientes)
  async getClientStripeConfig() {
    return this.request<ClientStripeConfig>('/api/clients/me/stripe');
  }
  async updateClientStripeConfig(data: {
    mode?: 'test' | 'live';
    secretKey?: string;
    publishableKey?: string;
    webhookSecret?: string;
    activeMode?: 'test' | 'live';
  }) {
    return this.request<ClientStripeConfig>('/api/clients/me/stripe', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Loyalty
  async getPrograms() {
    return this.request<any[]>('/api/loyalty/programs');
  }
  async createProgram(data: Record<string, unknown>) {
    return this.request<any>('/api/loyalty/programs', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateProgram(clientId: string, data: Record<string, unknown>) {
    return this.request<any>(`/api/loyalty/programs/${clientId}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteProgram(clientId: string) {
    return this.request(`/api/loyalty/programs/${clientId}`, { method: 'DELETE' });
  }
  async toggleLoyaltyProgram(clientId: string) {
    return this.request<any>(`/api/loyalty/programs/${clientId}/toggle`, { method: 'PATCH' });
  }
  async getLoyaltyCards(clientId?: string) {
    const params = clientId ? `?clientId=${clientId}` : '';
    return this.request<any[]>(`/api/loyalty/cards${params}`);
  }
  async createLoyaltyCardAdmin(data: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    clientId?: string;
  }) {
    return this.request<any>('/api/loyalty/cards/admin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async addLoyaltyStamp(cardId: string, data?: { bookingId?: string; serviceId?: string }) {
    return this.request<any>(`/api/loyalty/cards/${cardId}/stamps`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  // Card generation
  async generateCardQR(cardId: string) {
    return this.request<any>(`/api/loyalty/cards/${cardId}/qr`, { method: 'POST' });
  }
  async getProgramJoinQr(clientId: string, base?: string) {
    const params = base ? `?base=${encodeURIComponent(base)}` : '';
    return this.request<{
      url: string;
      qrCodeUrl: string;
      programId: string;
      clientSlug: string;
    }>(`/api/loyalty/programs/${clientId}/join-qr${params}`);
  }
  async generateCardImage(cardId: string) {
    return this.request<any>(`/api/loyalty/cards/${cardId}/image`, { method: 'POST' });
  }
  async sendCardWhatsApp(cardId: string, message?: string) {
    return this.request<any>(`/api/loyalty/cards/${cardId}/whatsapp`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }
  async scanQRCode(qrData: string, staffId?: string, note?: string) {
    return this.request<any>('/api/loyalty/qr/scan', {
      method: 'POST',
      body: JSON.stringify({ qrData, staffId, note }),
    });
  }
  async getCardQR(cardId: string) {
    return this.request<any>(`/api/loyalty/cards/${cardId}/qr`);
  }

  async getMemberships() {
    return this.request<MembershipPlan[]>('/api/memberships');
  }
  async createMembership(data: MembershipPlanInput) {
    return this.request<MembershipPlan>('/api/memberships', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateMembership(id: string, data: MembershipPlanInput) {
    return this.request<MembershipPlan>(`/api/memberships/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteMembership(id: string) {
    return this.request(`/api/memberships/${id}`, { method: 'DELETE' });
  }
  async getMembershipPurchases() {
    return this.request<MembershipPurchase[]>('/api/memberships/purchases');
  }

  async getPosCatalog() {
    return this.request<{ services: PosCatalogService[]; products: PosProduct[] }>('/api/pos/catalog');
  }
  async getPosSummary() {
    return this.request<PosSummary>('/api/pos/summary');
  }
  async getPosProducts() {
    return this.request<PosProduct[]>('/api/pos/products');
  }
  async createPosProduct(data: Partial<PosProduct>) {
    return this.request<PosProduct>('/api/pos/products', { method: 'POST', body: JSON.stringify(data) });
  }
  async updatePosProduct(id: string, data: Partial<PosProduct>) {
    return this.request<PosProduct>(`/api/pos/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deletePosProduct(id: string) {
    return this.request(`/api/pos/products/${id}`, { method: 'DELETE' });
  }
  async getPosSales(from?: string, to?: string) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString();
    return this.request<PosSale[]>(`/api/pos/sales${q ? `?${q}` : ''}`);
  }
  async createPosSale(data: {
    customerName?: string;
    customerPhone?: string;
    discount?: number;
    paymentMethod: string;
    notes?: string;
    receivedAmount?: number;
    items: { kind: string; name: string; quantity: number; unitPrice: number; serviceId?: string; productId?: string }[];
  }) {
    return this.request<PosSale>('/api/pos/sales', { method: 'POST', body: JSON.stringify(data) });
  }
  async voidPosSale(id: string) {
    return this.request<PosSale>(`/api/pos/sales/${id}/void`, { method: 'POST' });
  }
}

export interface MembershipPlan {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  interval: string;
  benefits: string[];
  isActive: boolean;
  sortOrder: number;
  _count?: { purchases: number };
}

export type MembershipPlanInput = Omit<Partial<MembershipPlan>, 'benefits'> & {
  benefits?: string[] | string;
};

export interface MembershipPurchase {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  status: string;
  currentPeriodEnd?: string | null;
  createdAt: string;
  plan?: { name: string; interval: string; price: number; currency: string };
}

export interface PosCatalogService {
  id: string;
  name: string;
  price?: number | null;
  duration: number;
  color: string;
}

export interface PosProduct {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  sku?: string | null;
  isActive: boolean;
}

export interface PosSaleItem {
  id: string;
  kind: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PosSale {
  id: string;
  customerName?: string | null;
  customerPhone?: string | null;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  status: string;
  notes?: string | null;
  receivedAmount?: number | null;
  createdAt: string;
  items: PosSaleItem[];
}

export interface PosSummary {
  todayCount: number;
  todayTotal: number;
  byMethod: Record<string, number>;
}

export const api = new ApiClient();
