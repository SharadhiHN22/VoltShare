import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';
import { createNotification } from '../services/notification.service';

/**
 * Initiate a payment for a booking.
 * Calculates the platform fee split and creates a Payment record.
 * Returns a mock payment order (placeholder for Razorpay integration).
 */
export const initiatePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payerId = req.user!.id;
    const { bookingId } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { charger: true, payment: true },
    });

    if (!booking) {
      throw new AppError('Booking not found.', 404);
    }

    if (booking.seekerId !== payerId) {
      throw new AppError('You can only pay for your own bookings.', 403);
    }

    if (booking.status === 'CANCELLED') {
      throw new AppError('Cannot pay for a cancelled booking.', 400);
    }

    if (booking.status === 'COMPLETED') {
      throw new AppError('This booking is already completed.', 400);
    }

    if (booking.status !== 'PENDING') {
      throw new AppError(`Cannot initiate payment for a booking with status ${booking.status}.`, 400);
    }

    // If payment already exists and is COMPLETED, reject
    if (booking.payment && booking.payment.status === 'COMPLETED') {
      throw new AppError('Payment has already been completed for this booking.', 400);
    }

    // Reuse existing pending/failed payment or create a new one
    let payment = booking.payment;
    const isNewPayment = !payment;

    if (!payment) {
      // Calculate fee split
      const amount = Number(booking.totalAmount);
      const platformFee = Math.round(((amount * config.platformFeePercent) / 100) * 100) / 100;
      const hostPayout = Math.round((amount - platformFee) * 100) / 100;
      const payeeId = booking.charger.hostId;

      payment = await prisma.payment.create({
        data: {
          bookingId,
          payerId,
          payeeId,
          amount,
          platformFee,
          hostPayout,
          currency: 'INR',
          status: 'PENDING',
        },
      });
    } else if (payment.status === 'FAILED') {
      // Re-activate previously failed payment
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'PENDING' },
      });
    }

    const amount = Number(payment.amount);

    // Attempt to create a real Razorpay Order if live/test credentials are configured
    let orderId = `order_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    let isRemoteOrder = false;

    const hasRealRazorpayConfig = Boolean(
      config.razorpayKeyId &&
      config.razorpayKeySecret &&
      config.razorpayKeyId.startsWith('rzp_') &&
      config.razorpayKeyId !== 'your-razorpay-key-id' &&
      config.razorpayKeySecret !== 'your-razorpay-key-secret'
    );

    if (hasRealRazorpayConfig) {
      try {
        const auth = Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64');
        const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify({
            amount: Math.round(amount * 100), // paise
            currency: 'INR',
            receipt: `rcpt_${payment.id.replace(/-/g, '').slice(0, 30)}`,
            notes: {
              bookingId,
              paymentId: payment.id,
            },
          }),
        });
        if (orderRes.ok) {
          const orderJson: any = await orderRes.json();
          if (orderJson?.id) {
            orderId = orderJson.id;
            isRemoteOrder = true;
          }
        } else {
          console.warn('[Razorpay Orders API] Failed to create remote order:', orderRes.status, await orderRes.text());
        }
      } catch (orderErr) {
        console.warn('[Razorpay Orders API] Failed to call Razorpay orders API:', orderErr);
      }
    }

    if (isRemoteOrder) {
      // Remote Razorpay order was successfully created on Razorpay's servers.
      // Update payment gatewayResponse and return checkout data to open Razorpay Checkout.
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          gatewayResponse: { orderId, isRemoteOrder: true, initiatedAt: new Date().toISOString() },
        },
      });

      res.status(isNewPayment ? 201 : 200).json({
        success: true,
        data: {
          paymentId: payment.id,
          bookingId: booking.id,
          orderId,
          amount: payment.amount,
          currency: payment.currency,
          gatewayOrderId: orderId,
          keyId: config.razorpayKeyId,
          isRemoteOrder: true,
          requiresCheckoutModal: false,
          completed: false,
        },
      });
      return;
    }

    // ── VoltShare Fallback Payment Checkout ─────────────────────────────────
    // Razorpay credentials are not configured or the remote order could not be
    // created because the integration is unavailable.
    // Return checkout details for the VoltShare Payment Checkout modal.
    // The payment remains PENDING until the user submits their payment method in the checkout modal.
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        gatewayResponse: { orderId, isRemoteOrder: false, initiatedAt: new Date().toISOString() },
      },
    });

    res.status(isNewPayment ? 201 : 200).json({
      success: true,
      data: {
        paymentId: payment.id,
        bookingId: booking.id,
        orderId,
        amount: payment.amount,
        currency: payment.currency,
        gatewayOrderId: null,
        keyId: null,
        isRemoteOrder: false,
        requiresCheckoutModal: true,
        completed: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process VoltShare Checkout when Razorpay is not configured.
 * Validates the authenticated user, verifies booking ownership & PENDING status,
 * validates chosen payment method (UPI, Card, Net Banking, Wallet),
 * transitions Payment to COMPLETED and Booking to CONFIRMED,
 * and creates Driver & Host notifications.
 * Endpoint: POST /api/payments/process-checkout
 */
export const processFallbackCheckout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const {
      bookingId,
      paymentId,
      method,
      paymentMethod,
      paymentDetails,
      upiId: bodyUpiId,
      cardNumber: bodyCardNumber,
      cardLast4: bodyCardLast4,
      cardholderName: bodyCardholderName,
      bankName: bodyBankName,
      walletName: bodyWalletName,
      walletPhone: bodyWalletPhone,
    } = req.body;

    const details = {
      ...req.body,
      ...(paymentDetails || {}),
      upiId: paymentDetails?.upiId || bodyUpiId,
      cardNumber: paymentDetails?.cardNumber || bodyCardNumber,
      cardLast4: paymentDetails?.cardLast4 || bodyCardLast4,
      cardholderName: paymentDetails?.cardholderName || bodyCardholderName,
      bankName: paymentDetails?.bankName || bodyBankName,
      walletName: paymentDetails?.walletName || bodyWalletName,
      walletPhone: paymentDetails?.walletPhone || bodyWalletPhone,
    };

    if (!bookingId || !paymentId) {
      throw new AppError('Booking ID and Payment ID are required.', 400);
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { charger: true, payment: true },
    });

    if (!booking) {
      throw new AppError('Booking not found.', 404);
    }

    if (booking.seekerId !== userId) {
      throw new AppError('You can only pay for your own bookings.', 403);
    }

    if (booking.status === 'CANCELLED') {
      throw new AppError('Cannot pay for a cancelled booking.', 400);
    }

    if (booking.status === 'COMPLETED' || booking.status === 'CONFIRMED' || booking.status === 'ACTIVE') {
      throw new AppError(`Booking is already ${booking.status.toLowerCase()}.`, 400);
    }

    if (!booking.payment || booking.payment.id !== paymentId) {
      throw new AppError('Invalid payment session for this booking.', 400);
    }

    if (booking.payment.status === 'COMPLETED') {
      throw new AppError('Payment has already been completed for this booking.', 400);
    }

    // Validate method
    const validMethods = ['UPI', 'CARD', 'NETBANKING', 'WALLET'];
    const chosenMethod = String(paymentMethod || method || 'UPI').toUpperCase();
    if (!validMethods.includes(chosenMethod)) {
      throw new AppError('Invalid payment method selected.', 400);
    }

    // Validate details according to method without storing sensitive card details
    const cleanDetails: Record<string, any> = { method: chosenMethod };

    if (chosenMethod === 'UPI') {
      const upiId = details.upiId?.trim();
      if (!upiId || !/^[\w.\-_]{2,}@[\w.\-_]{2,}$/.test(upiId)) {
        throw new AppError('Please enter a valid UPI ID (e.g., name@upi or user@okhdfcbank).', 400);
      }
      cleanDetails.upiId = upiId;
    } else if (chosenMethod === 'CARD') {
      const cardholderName = details.cardholderName?.trim();
      if (!cardholderName || cardholderName.length < 2) {
        throw new AppError('Please enter the cardholder name.', 400);
      }
      cleanDetails.cardholderName = cardholderName;
      if (details.cardLast4) {
        cleanDetails.cardLast4 = String(details.cardLast4).slice(-4);
      } else if (details.cardNumber) {
        const cleanedNum = String(details.cardNumber).replace(/\s+/g, '');
        if (cleanedNum.length >= 12) {
          cleanDetails.cardLast4 = cleanedNum.slice(-4);
        }
      }
    } else if (chosenMethod === 'NETBANKING') {
      const bankName = details.bankName?.trim();
      if (!bankName) {
        throw new AppError('Please select a bank for Net Banking payment.', 400);
      }
      cleanDetails.bankName = bankName;
    } else if (chosenMethod === 'WALLET') {
      const walletName = details.walletName?.trim();
      if (!walletName) {
        throw new AppError('Please select a wallet provider.', 400);
      }
      cleanDetails.walletName = walletName;
    }

    const transactionId = `vs_pay_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    const [completedPayment, confirmedBooking] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          transactionId,
          gatewayResponse: {
            ...cleanDetails,
            completedAt: new Date().toISOString(),
          },
        },
      }),
      prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CONFIRMED',
        },
      }),
    ]);

    // Dispatch Driver & Host notifications
    const chargerTitle = booking.charger?.title || 'the station';
    const hostId = booking.charger?.hostId || booking.payment.payeeId;
    const driverId = booking.seekerId;
    const amountNum = Number(booking.payment.amount);

    await Promise.allSettled([
      createNotification({
        userId: driverId,
        type: 'BOOKING_CONFIRMED',
        title: 'Booking confirmed',
        message: `Your booking at ${chargerTitle} has been confirmed.`,
      }),
      createNotification({
        userId: driverId,
        type: 'PAYMENT_SUCCESS',
        title: 'Payment successful',
        message: `Payment of ₹${amountNum.toFixed(0)} for your charging booking was successful.`,
      }),
      hostId
        ? createNotification({
            userId: hostId,
            type: 'NEW_BOOKING',
            title: 'New booking received',
            message: `You received a new booking for ${chargerTitle}.`,
          })
        : Promise.resolve(),
    ]);

    res.json({
      success: true,
      message: 'Payment processed successfully. Booking confirmed.',
      data: {
        payment: completedPayment,
        booking: confirmedBooking,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify or simulate payment confirmation.
 * Marks payment as COMPLETED and booking as CONFIRMED.
 */
export const verifyPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { paymentId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: { charger: true },
        },
      },
    });

    if (!payment) {
      throw new AppError('Payment not found.', 404);
    }

    if (payment.payerId !== req.user!.id) {
      throw new AppError('You are not authorized to verify this payment.', 403);
    }

    if (payment.status === 'COMPLETED') {
      res.json({
        success: true,
        data: {
          payment,
          booking: payment.booking,
        },
      });
      return;
    }

    if (payment.booking?.status === 'CANCELLED') {
      throw new AppError('Cannot verify payment for a cancelled booking.', 400);
    }

    // Verify Razorpay payment signature when live/test key secret is configured
    if (
      config.razorpayKeySecret &&
      config.razorpayKeySecret.length > 5 &&
      config.razorpayKeySecret !== 'your-razorpay-key-secret'
    ) {
      if (!razorpaySignature || !razorpayOrderId || !razorpayPaymentId) {
        throw new AppError('Payment signature verification requires signature, orderId, and paymentId.', 400);
      }

      const hmacPayload = `${razorpayOrderId}|${razorpayPaymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpayKeySecret)
        .update(hmacPayload)
        .digest('hex');

      const isAuthentic =
        razorpaySignature.length === expectedSignature.length &&
        crypto.timingSafeEqual(Buffer.from(razorpaySignature), Buffer.from(expectedSignature));

      if (!isAuthentic) {
        throw new AppError('Invalid Razorpay payment signature. Verification rejected.', 400);
      }
    }

    const [updatedPayment, updatedBooking] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          transactionId: razorpayPaymentId || `pay_${Date.now()}`,
        },
      }),
      prisma.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: 'CONFIRMED',
        },
      }),
    ]);

    // Create notifications for Driver and Host
    const chargerTitle = payment.booking?.charger?.title || 'the station';
    const hostId = payment.booking?.charger?.hostId || payment.payeeId;
    const driverId = payment.payerId;
    const amountNum = Number(payment.amount);

    await Promise.allSettled([
      // Driver: Booking confirmed
      createNotification({
        userId: driverId,
        type: 'BOOKING_CONFIRMED',
        title: 'Booking confirmed',
        message: `Your booking at ${chargerTitle} has been confirmed.`,
      }),
      // Driver: Payment successful
      createNotification({
        userId: driverId,
        type: 'PAYMENT_SUCCESS',
        title: 'Payment successful',
        message: `Payment of ₹${amountNum.toFixed(0)} for your charging booking was successful.`,
      }),
      // Host: New booking received
      hostId
        ? createNotification({
            userId: hostId,
            type: 'NEW_BOOKING',
            title: 'New booking received',
            message: `You received a new booking for ${chargerTitle}.`,
          })
        : Promise.resolve(),
    ]);

    res.json({
      success: true,
      data: {
        payment: updatedPayment,
        booking: updatedBooking,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle payment gateway webhook callback.
 * Verifies the signature (placeholder), updates payment status,
 * and confirms the booking.
 */
export const handleWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const webhookSecret = config.razorpayKeySecret || process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret) {
      if (!signature) {
        throw new AppError('Missing x-razorpay-signature header.', 401);
      }
      const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        throw new AppError('Invalid webhook signature.', 401);
      }
    } else {
      // In development mode, require a development authorization header to prevent unauthorized access
      const devSecret = req.headers['x-webhook-secret'] as string | undefined;
      const expectedSecret = process.env.DEV_WEBHOOK_SECRET || 'voltshare-dev-webhook-secret';
      if (!devSecret || devSecret !== expectedSecret) {
        throw new AppError('Unauthorized webhook access. Valid webhook signature or dev secret required.', 401);
      }
    }

    const { paymentId, transactionId, status, gatewayResponse } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: { charger: true },
        },
      },
    });

    if (!payment) {
      throw new AppError('Payment not found.', 404);
    }

    const paymentStatus = status === 'success' ? 'COMPLETED' : 'FAILED';

    await prisma.$transaction([
      // Update payment record
      prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: paymentStatus,
          transactionId,
          gatewayResponse: gatewayResponse || {},
        },
      }),
      // If payment succeeded, confirm the booking
      ...(paymentStatus === 'COMPLETED'
        ? [
            prisma.booking.update({
              where: { id: payment.bookingId },
              data: { status: 'CONFIRMED' },
            }),
          ]
        : []),
    ]);

    if (paymentStatus === 'COMPLETED') {
      const chargerTitle = payment.booking?.charger?.title || 'the station';
      const hostId = payment.booking?.charger?.hostId || payment.payeeId;
      const driverId = payment.payerId;
      const amountNum = Number(payment.amount);

      await Promise.allSettled([
        createNotification({
          userId: driverId,
          type: 'BOOKING_CONFIRMED',
          title: 'Booking confirmed',
          message: `Your booking at ${chargerTitle} has been confirmed.`,
        }),
        createNotification({
          userId: driverId,
          type: 'PAYMENT_SUCCESS',
          title: 'Payment successful',
          message: `Payment of ₹${amountNum.toFixed(0)} for your charging booking was successful.`,
        }),
        hostId
          ? createNotification({
              userId: hostId,
              type: 'NEW_BOOKING',
              title: 'New booking received',
              message: `You received a new booking for ${chargerTitle}.`,
            })
          : Promise.resolve(),
      ]);
    }

    res.json({ success: true, message: `Payment ${paymentStatus.toLowerCase()}.` });
  } catch (error) {
    next(error);
  }
};

/**
 * Get the authenticated user's payment history.
 */
export const getPaymentHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;

    const payments = await prisma.payment.findMany({
      where: {
        OR: [{ payerId: userId }, { payeeId: userId }],
      },
      include: {
        booking: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            charger: { select: { title: true, address: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
};

/**
 * Get aggregated earnings summary for a host.
 */
export const getHostEarnings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const hostId = req.user!.id;

    // All completed payments where the host is the payee
    const allPayments = await prisma.payment.findMany({
      where: { payeeId: hostId },
    });

    const completedPayments = allPayments.filter((p) => p.status === 'COMPLETED');
    const pendingPayments = allPayments.filter((p) => p.status === 'PENDING');

    // This month's earnings
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthPayments = completedPayments.filter(
      (p) => p.createdAt >= startOfMonth,
    );

    const totalEarnings = completedPayments.reduce((sum, p) => sum + Number(p.hostPayout), 0);
    const pendingPayout = pendingPayments.reduce((sum, p) => sum + Number(p.hostPayout), 0);
    const thisMonthEarnings = thisMonthPayments.reduce((sum, p) => sum + Number(p.hostPayout), 0);

    res.json({
      success: true,
      data: {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        pendingPayout: Math.round(pendingPayout * 100) / 100,
        completedPayouts: completedPayments.length,
        totalBookings: allPayments.length,
        thisMonthEarnings: Math.round(thisMonthEarnings * 100) / 100,
      },
    });
  } catch (error) {
    next(error);
  }
};
