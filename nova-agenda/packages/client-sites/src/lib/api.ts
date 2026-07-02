const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ClientInfo {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  primaryColor: string;
  services: { id: string; name: string; description?: string; duration: number; price?: number; color: string }[];
  workingHours: { dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean }[];
  plan?: string;
  bookingDisabled?: boolean;
  message?: string;
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
}

export interface LoyaltyCard {
  id: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  stampsEarned: number;
  isCompleted: boolean;
  stamps?: { id: string; createdAt: string }[];
  program?: LoyaltyProgram;
}

export async function getClientInfo(slug: string): Promise<ClientInfo | null> {
  try {
    const res = await fetch(`${API_URL}/api/public/client/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function getAvailableSlots(clientSlug: string, serviceId: string, date: string) {
  try {
    const res = await fetch(`${API_URL}/api/public/slots?clientSlug=${clientSlug}&serviceId=${serviceId}&date=${date}`);
    if (!res.ok) return { slots: [] };
    return res.json();
  } catch { return { slots: [] }; }
}

export async function createBooking(data: {
  clientSlug: string; serviceId: string; customerName: string;
  customerEmail?: string; customerPhone?: string; date: string;
  startTime: string; notes?: string;
}) {
  const res = await fetch(`${API_URL}/api/bookings`, {
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
    const res = await fetch(`${API_URL}/api/loyalty/programs/client/${clientId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const program = await res.json();
    return program?.isActive ? program : null;
  } catch {
    return null;
  }
}

export async function checkLoyaltyCard(clientId: string, phone: string): Promise<LoyaltyCard | null> {
  try {
    const res = await fetch(`${API_URL}/api/loyalty/cards/check?clientId=${clientId}&phone=${encodeURIComponent(phone)}`);
    if (!res.ok) return null;
    const card = await res.json();
    return card || null;
  } catch {
    return null;
  }
}

export async function getLoyaltyCard(cardId: string): Promise<LoyaltyCard | null> {
  try {
    const res = await fetch(`${API_URL}/api/loyalty/cards/customer/${cardId}`, { cache: 'no-store' });
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
  const res = await fetch(`${API_URL}/api/loyalty/cards`, {
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
