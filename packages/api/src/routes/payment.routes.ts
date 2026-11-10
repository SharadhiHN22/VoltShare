import { Router } from 'express';
import {
  initiatePayment,
  verifyPayment,
  handleWebhook,
  getPaymentHistory,
  getHostEarnings,
  processFallbackCheckout,
} from '../controllers/payment.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

/** POST /api/payments/initiate — Start a payment for a booking */
router.post('/initiate', authenticate, initiatePayment);

/** POST /api/payments/process-checkout — VoltShare fallback checkout */
router.post('/process-checkout', authenticate, processFallbackCheckout);
router.post('/checkout', authenticate, processFallbackCheckout);

/** POST /api/payments/verify — Verify or complete payment callback */
router.post('/verify', authenticate, verifyPayment);

/** POST /api/payments/webhook — Razorpay callback (no auth — verified by signature) */
router.post('/webhook', handleWebhook);

/** GET /api/payments/history — Get current user's payment history */
router.get('/history', authenticate, getPaymentHistory);

/** GET /api/payments/host/earnings or /api/payments/earnings — Get host earnings summary (HOST only) */
router.get('/host/earnings', authenticate, authorize('HOST'), getHostEarnings);
router.get('/earnings', authenticate, authorize('HOST'), getHostEarnings);

export default router;
