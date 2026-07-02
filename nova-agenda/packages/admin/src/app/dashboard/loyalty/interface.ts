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
  rewards?: LoyaltyReward[];
  _count?: { cards: number };
}
