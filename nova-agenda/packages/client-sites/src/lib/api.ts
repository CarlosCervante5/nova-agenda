function getApiBaseUrl() {
  if (typeof window !== 'undefined') return '';
  const configured = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('API_URL or NEXT_PUBLIC_API_URL must be set in production');
  }
  return 'http://localhost:3001';
}

export interface ClientInfo {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  email?: string;
  phone?: string;
  address?: string;
  logo?: string;
  primaryColor: string;
  headlineColor?: string;
  bodyTextColor?: string;
  labelTextColor?: string;
  surfaceBgColor?: string;
  tagline?: string;
  about?: string;
  coverImage?: string;
  instagram?: string;
  facebook?: string;
  whatsappPhone?: string;
  linktreeUrl?: string;
  customLinks?: string;
  websiteEnabled?: boolean;
  services: {
    id: string;
    name: string;
    description?: string;
    duration: number;
    price?: number;
    color: string;
    categoryId?: string | null;
    category?: {
      id: string;
      name: string;
      color: string;
      parentId?: string | null;
      parent?: { id: string; name: string; color: string } | null;
    } | null;
    useCustomHours?: boolean;
    capacity?: number;
    kind?: string;
    workingHours?: { dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean }[];
  }[];
  categories?: {
    id: string;
    name: string;
    description?: string;
    color: string;
    parentId?: string | null;
    children?: { id: string; name: string; description?: string; color: string; parentId?: string | null }[];
  }[];
  staff?: {
    id: string;
    name: string;
    title?: string;
    bio?: string;
    color: string;
    avatarUrl?: string;
    serviceIds: string[];
  }[];
  workingHours: { dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean }[];
  plan?: string;
  bookingDisabled?: boolean;
  message?: string;
  bookingFormEnabled?: boolean;
  bookingRequirePhone?: boolean;
  bookingRequireEmail?: boolean;
  bookingShowNotes?: boolean;
  bookingIntroText?: string;
  bookingSuccessText?: string;
  bookingConfirmAuto?: boolean;
  studioBooking?: boolean;
  slotGapMinutes?: number;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description?: string;
  stampsRequired: number;
  rewardType: string;
  value: number;
}

export interface LoyaltyProgram {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  stampsToReward: number;
  isActive: boolean;
  stampIcon: string;
  stampColor: string;
  backgroundColor: string;
  textColor: string;
  welcomeMessage?: string;
  rewardMessage?: string;
  rewards: LoyaltyReward[];
  cardDesign?: unknown;
}

export interface LoyaltyCard {
  id: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  stampsEarned: number;
  visitsCount?: number;
  isCompleted: boolean;
  lastVisitAt?: string;
  stamps?: { id: string; createdAt: string; bookingId?: string }[];
  program?: LoyaltyProgram;
}

export async function getClientInfo(slug: string): Promise<ClientInfo | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/public/client/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function getAvailableSlots(clientSlug: string, serviceId: string, date: string) {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/public/slots?clientSlug=${clientSlug}&serviceId=${serviceId}&date=${date}`);
    if (!res.ok) return { slots: [] };
    return res.json();
  } catch { return { slots: [] }; }
}

export async function createBooking(data: {
  clientSlug: string; serviceId: string; staffId?: string; customerName: string;
  customerEmail?: string; customerPhone?: string; date: string;
  startTime: string; notes?: string;
}) {
  const res = await fetch(`${getApiBaseUrl()}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Booking failed' }));
    throw new Error(error.error);
  }
  return res.json();
}

export async function getLoyaltyProgram(clientId: string): Promise<LoyaltyProgram | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/loyalty/programs/client/${clientId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const program = await res.json();
    return program?.isActive ? program : null;
  } catch {
    return null;
  }
}

export async function checkLoyaltyCard(clientId: string, phone: string): Promise<LoyaltyCard | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/loyalty/cards/check?clientId=${clientId}&phone=${encodeURIComponent(phone)}`);
    if (!res.ok) return null;
    const card = await res.json();
    return card || null;
  } catch {
    return null;
  }
}

export async function getLoyaltyCard(cardId: string): Promise<LoyaltyCard | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/loyalty/cards/customer/${cardId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function createLoyaltyCard(data: {
  clientId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
}): Promise<LoyaltyCard> {
  const res = await fetch(`${getApiBaseUrl()}/api/loyalty/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'No se pudo crear la tarjeta' }));
    throw new Error(error.error);
  }
  return res.json();
}

export interface MembershipPlan {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  interval: string;
  benefits: string[];
  classesPerPeriod?: number;
}

export interface StudioClass {
  serviceId: string;
  name: string;
  description?: string | null;
  duration: number;
  price: number;
  color: string;
  category?: { id: string; name: string; color: string } | null;
  startTime: string;
  endTime: string;
  capacity: number;
  taken: number;
  remaining: number;
  full: boolean;
  past: boolean;
}

export interface StudioAccountBooking {
  id: string;
  serviceName: string;
  serviceColor: string;
  duration: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  canCancelWithCredit: boolean;
  canReschedule: boolean;
  hoursLeft: number;
}

export interface StudioAccount {
  creditsLeft: number;
  creditsTotal: number;
  planName: string | null;
  validUntil: string | null;
  purchaseId: string | null;
  trialUsed: boolean;
  bookings: StudioAccountBooking[];
}

async function studioRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error de reserva' }));
    throw new Error(error.error || 'Error de reserva');
  }
  return res.json();
}

export async function getStudioDay(slug: string, date: string): Promise<{ date: string; classes: StudioClass[]; dropInPrice: number }> {
  return studioRequest(`/api/studio/${slug}/day?date=${date}`);
}

export async function getStudioAccount(slug: string, data: { phone?: string; email?: string }): Promise<StudioAccount> {
  const params = new URLSearchParams();
  if (data.phone) params.set('phone', data.phone);
  if (data.email) params.set('email', data.email);
  return studioRequest(`/api/studio/${slug}/account?${params.toString()}`);
}

export async function bookStudioClass(slug: string, data: {
  serviceId: string;
  date: string;
  startTime: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  method: 'CREDIT' | 'RECEPTION' | 'STRIPE' | 'TRIAL';
  promoCode?: string;
  returnUrl?: string;
}): Promise<{ url?: string; booking?: { id: string; service?: { name: string } }; creditsUsed?: number }> {
  return studioRequest(`/api/studio/${slug}/book`, { method: 'POST', body: JSON.stringify(data) });
}

export async function confirmStudioClass(slug: string, sessionId: string) {
  return studioRequest(`/api/studio/${slug}/confirm`, { method: 'POST', body: JSON.stringify({ sessionId }) });
}

export async function cancelStudioClass(slug: string, data: { bookingId: string; customerPhone?: string; customerEmail?: string }) {
  return studioRequest<{ cancelled: boolean; creditRestored: boolean; message: string }>(`/api/studio/${slug}/cancel`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function rescheduleStudioClass(slug: string, data: {
  bookingId: string;
  customerPhone?: string;
  customerEmail?: string;
  serviceId: string;
  date: string;
  startTime: string;
}) {
  return studioRequest(`/api/studio/${slug}/reschedule`, { method: 'POST', body: JSON.stringify(data) });
}

export async function joinStudioWaitlist(slug: string, data: {
  serviceId: string;
  date: string;
  startTime: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
}) {
  return studioRequest(`/api/studio/${slug}/waitlist`, { method: 'POST', body: JSON.stringify(data) });
}

export async function getMembershipPlans(slug: string): Promise<MembershipPlan[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/memberships/public/${slug}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.plans || [];
  } catch {
    return [];
  }
}

export async function createMembershipCheckout(data: {
  clientSlug: string;
  planId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  returnUrl: string;
}): Promise<{ url: string; sessionId: string }> {
  const res = await fetch(`${getApiBaseUrl()}/api/memberships/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'No se pudo iniciar el checkout' }));
    throw new Error(error.error);
  }
  return res.json();
}

export async function confirmMembership(data: {
  sessionId: string;
  clientSlug: string;
}): Promise<{ status: string; plan?: { name: string } }> {
  const res = await fetch(`${getApiBaseUrl()}/api/memberships/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'No se pudo confirmar la compra' }));
    throw new Error(error.error);
  }
  return res.json();
}
