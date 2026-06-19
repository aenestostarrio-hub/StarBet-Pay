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
  authUid?: string;
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
  allowDeposit?: boolean;
  allowWithdrawal?: boolean;
}

export interface AppConfig {
  popupEnabled: boolean;
  popupTitle: string;
  popupMessage: string;
  supportWhatsapp: string;
  withdrawalPhysVille: string;
  withdrawalPhysRue: string;
  socialWhatsapp?: string;
  socialTiktok?: string;
  socialTelegram?: string;
  socialFacebook?: string;
  adminEmailRecipients?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  resendApiKey?: string;
  emailSenderName?: string;
}

export interface PronoMatch {
  homeTeam: string;
  awayTeam: string;
  prediction: string;
  odd: number;
  id: number;
  status?: 'pending' | 'won' | 'lost';
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

export interface DBNotification {
  id: string;
  user_id: string; // Recipient phone number or 'admin'
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  txId?: string; // Point to transaction if relevant
  txType?: 'deposit' | 'withdrawal' | 'commission_payout';
  txStatus?: 'pending' | 'validated' | 'rejected';
  couponId?: string; // Point to coupon if relevant
}

export interface FCMToken {
  id: string;
  phone: string;
  token: string;
  updatedAt: string;
}

export interface DBState {
  users: Record<string, DBUser>;
  transactions: DBTransaction[];
  paymentMethods: PaymentMethod[];
  config: AppConfig;
  coupons: SportCoupon[];
  couponHistory: string[];
  pastCoupons?: SportCoupon[];
  notifications?: DBNotification[];
  fcmTokens?: FCMToken[];
}
