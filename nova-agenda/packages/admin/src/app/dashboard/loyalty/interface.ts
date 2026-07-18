export interface LoyaltyStamp {
  id: string;
  cardId: string;
  bookingId?: string;
  createdAt: string;
}

export interface LoyaltyCard {
  id: string;
  programId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  stampsEarned: number;
  visitsCount?: number;
  stampsRedeemed: number;
  lastVisitAt?: string;
  isCompleted: boolean;
  completedAt?: string;
  stamps?: LoyaltyStamp[];
  _count?: { stamps: number };
}

export interface LoyaltyReward {
  id: string;
  programId: string;
  name: string;
  description?: string;
  stampsRequired: number;
  rewardType: string;
  value: number;
  serviceId?: string;
  isActive: boolean;
  sortOrder: number;
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
  enableWhatsApp: boolean;
  welcomeMessage?: string;
  rewardMessage?: string;
  // Card generation options
  cardModes?: string; // QR, WALLET, IMAGE, WHATSAPP (comma-separated)
  walletPassTypeIdentifier?: string;
  walletTeamIdentifier?: string;
  walletOrganizationName?: string;
  cardTemplateUrl?: string;
  qrSecret?: string;
  rewards?: LoyaltyReward[];
  _count?: { cards: number };
}
