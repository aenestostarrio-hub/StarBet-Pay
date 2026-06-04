export interface DBUser {
  phone: string;
  name: string;
  role: 'admin' | 'user';
  passwordHash: string;
  parentPhone?: string; // sponsor phone
  referralCode: string;
  balanceCommission: number;
  balanceCommissionWithdrawn: number;
  mfaEnabled: boolean;
  createdAt: string;
}

export interface DBTransaction {
  id: string; // unique transaction session ID
  type: 'deposit' | 'withdrawal' | 'commission_payout';
  amount: number;
  userPhone: string;
  userName: string;
  xbetAccount: string;
  paymentMethod: string;
  paymentNumber: string;
  screenshot?: string; // base64 screenshot
  withdrawCode?: string; // withdrawal code 1xbet
  status: 'pending' | 'validated' | 'rejected';
  date: string;
  rejectionReason?: string;
  appliedCommission?: boolean;
}

export interface PaymentMethod {
  name: string;
  number: string;
  active: boolean;
}

export interface AppConfig {
  popupEnabled: boolean;
  popupTitle: string;
  popupMessage: string;
  supportWhatsapp: string;
  withdrawalPhysVille: string;
  withdrawalPhysRue: string;
}

export interface PronoMatch {
  homeTeam: string;
  awayTeam: string;
  prediction: string;
  odd: number;
  id: number;
}

export interface SportCoupon {
  id: string;
  title: string; // e.g. "COUPON SÉCURISÉ (COTE ~2)"
  confidence: 'ÉLEVÉ' | 'MOYEN' | 'RISQUE ÉLEVÉ';
  totalCote: number;
  matches: PronoMatch[];
  status?: 'pending' | 'won' | 'lost';
  date?: string;
}

export interface DBState {
  users: Record<string, DBUser>;
  transactions: DBTransaction[];
  paymentMethods: PaymentMethod[];
  config: AppConfig;
  coupons: SportCoupon[];
  couponHistory: string[];
  pastCoupons?: SportCoupon[];
}
