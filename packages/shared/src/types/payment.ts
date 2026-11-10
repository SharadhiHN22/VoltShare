// ── Payment Types ────────────────────────────────────

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface Payment {
  id: string;
  bookingId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  platformFee: number;
  hostPayout: number;
  currency: string;
  status: PaymentStatus;
  transactionId?: string;
  gatewayResponse?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface InitiatePaymentInput {
  bookingId: string;
}

export interface ProcessCheckoutInput {
  bookingId: string;
  paymentId: string;
  method: 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET';
  paymentDetails?: {
    upiId?: string;
    cardholderName?: string;
    cardNumber?: string;
    expiry?: string;
    cvv?: string;
    bankName?: string;
    walletName?: string;
  };
}

export interface PaymentResponse {
  paymentId?: string;
  bookingId?: string;
  orderId: string;
  amount: number;
  currency: string;
  gatewayOrderId: string | null;
  keyId?: string | null;
  isRemoteOrder?: boolean;
  requiresCheckoutModal?: boolean;
  completed?: boolean;
  transactionId?: string;
}

export interface EarningsSummary {
  totalEarnings: number;
  pendingPayout: number;
  completedPayouts: number;
  totalBookings: number;
  thisMonthEarnings: number;
}
