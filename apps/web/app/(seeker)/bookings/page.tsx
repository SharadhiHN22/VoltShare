'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  ArrowRight,
  QrCode,
  Loader2,
  CreditCard,
  Star,
  Smartphone,
  Building2,
  Wallet,
  Lock,
  ShieldCheck,
  Play,
  X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { bookingApi, paymentApi, reviewApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

/**
 * Loads the official Razorpay Checkout SDK dynamically.
 * Resolves true if Razorpay is ready on window.Razorpay.
 */
const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);

    const existingScript = document.getElementById('razorpay-checkout-script');
    if (existingScript) {
      existingScript.onload = () => resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'COMPLETED' | 'CANCELLED'>('UPCOMING');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payMessage, setPayMessage] = useState<{ id: string; success: boolean; text: string } | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Check In and Complete Session state
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Fallback Checkout Modal State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutBooking, setCheckoutBooking] = useState<any | null>(null);
  const [checkoutPaymentData, setCheckoutPaymentData] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'NETBANKING' | 'WALLET'>('UPI');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Form Fields for Modal
  const [upiId, setUpiId] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [walletName, setWalletName] = useState('PhonePe');
  const [walletPhone, setWalletPhone] = useState('');

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await bookingApi.list();
      setBookings(res.data || []);
    } catch (err) {
      console.error('Failed to load user bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    setCancellingId(bookingId);
    setPayMessage(null);
    try {
      await bookingApi.cancel(bookingId);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'CANCELLED' } : b))
      );
      setConfirmCancelId(null);
      setPayMessage({
        id: bookingId,
        success: true,
        text: 'Booking has been cancelled successfully.',
      });
    } catch (err: any) {
      setPayMessage({
        id: bookingId,
        success: false,
        text: err?.message || 'Failed to cancel booking.',
      });
    } finally {
      setCancellingId(null);
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    setCheckingInId(bookingId);
    setPayMessage(null);
    try {
      await bookingApi.checkIn(bookingId);
      setPayMessage({
        id: bookingId,
        success: true,
        text: 'Checked in successfully! Charging session is now active.',
      });
      const updated = await bookingApi.list();
      setBookings(updated.data || []);
    } catch (err: any) {
      setPayMessage({
        id: bookingId,
        success: false,
        text: err?.response?.data?.message || err?.message || 'Failed to check in.',
      });
    } finally {
      setCheckingInId(null);
    }
  };

  const handleCompleteCharging = async (bookingId: string) => {
    setCompletingId(bookingId);
    setPayMessage(null);
    try {
      await bookingApi.complete(bookingId);
      setPayMessage({
        id: bookingId,
        success: true,
        text: 'Charging session completed successfully!',
      });
      const updated = await bookingApi.list();
      setBookings(updated.data || []);
      setActiveTab('COMPLETED');
    } catch (err: any) {
      setPayMessage({
        id: bookingId,
        success: false,
        text: err?.response?.data?.message || err?.message || 'Failed to complete session.',
      });
    } finally {
      setCompletingId(null);
    }
  };

  useEffect(() => {
    fetchBookings();
    loadRazorpayScript();
  }, []);

  const handlePayNow = async (booking: any) => {
    setPayingId(booking.id);
    setPayMessage(null);
    try {
      // 1. Initiate payment on backend
      const res = await paymentApi.initiate({ bookingId: booking.id });
      const paymentData = res.data;
      const paymentId = paymentData?.paymentId;
      if (!paymentData || !paymentId) {
        throw new Error('Payment initialization failed to return payment ID');
      }

      // If remote Razorpay order is available, open official Razorpay Checkout modal
      if (paymentData.isRemoteOrder && paymentData.orderId) {
        const isScriptLoaded = await loadRazorpayScript();
        if (!isScriptLoaded) {
          throw new Error('Unable to load Razorpay payment gateway. Please check your internet connection.');
        }

        const key =
          paymentData.keyId && paymentData.keyId.startsWith('rzp_') && paymentData.keyId !== 'your-razorpay-key-id'
            ? paymentData.keyId
            : process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID.startsWith('rzp_')
            ? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
            : 'rzp_test_1DP5mmOlF5G5ag';
        const amountInPaise = Math.round(Number(paymentData.amount) * 100);

        const options: any = {
          key,
          amount: amountInPaise,
          currency: paymentData.currency || 'INR',
          name: 'VoltShare',
          description: `Charging Session at ${booking.charger?.title || 'EV Station'}`,
          image: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/26a1.png',
          prefill: {
            name: booking.seeker?.name || '',
            email: booking.seeker?.email || '',
            contact: booking.seeker?.phone || '',
          },
          notes: {
            bookingId: booking.id,
            paymentId,
          },
          theme: {
            color: '#10b981',
          },
          order_id: paymentData.orderId,
          modal: {
            ondismiss: () => {
              setPayingId(null);
              setPayMessage({
                id: booking.id,
                success: false,
                text: 'Payment was dismissed or closed. You can retry paying at any time.',
              });
            },
          },
          handler: async (response: any) => {
            try {
              await paymentApi.verify({
                paymentId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id || paymentData.orderId,
                razorpaySignature: response.razorpay_signature,
              });

              setPayMessage({
                id: booking.id,
                success: true,
                text: `Payment of ₹${Number(paymentData.amount).toFixed(0)} successful! Booking confirmed.`,
              });

              const updated = await bookingApi.list();
              setBookings(updated.data || []);
            } catch (err: any) {
              setPayMessage({
                id: booking.id,
                success: false,
                text: `Payment failed: ${err?.response?.data?.message || err?.message || 'Payment verification failed.'}`,
              });
            } finally {
              setPayingId(null);
            }
          },
        };

        const rzpInstance = new (window as any).Razorpay(options);
        rzpInstance.on('payment.failed', (failResponse: any) => {
          setPayingId(null);
          const err = failResponse?.error || {};
          console.error('[Razorpay Payment Failed]', err);
          let failureDetail = err.description || err.reason || 'Payment failed. Please try again.';
          setPayMessage({
            id: booking.id,
            success: false,
            text: failureDetail,
          });
        });

        rzpInstance.open();
        return;
      }

      // If Razorpay remote order is not available, open the VoltShare Checkout modal
      setCheckoutBooking(booking);
      setCheckoutPaymentData(paymentData);
      setPaymentMethod('UPI');
      setUpiId(booking.seeker?.email ? `${booking.seeker.email.split('@')[0]}@okaxis` : '');
      setCardholderName(booking.seeker?.name || '');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      setBankName('HDFC Bank');
      setWalletName('PhonePe');
      setWalletPhone(booking.seeker?.phone || '');
      setCheckoutError(null);
      setCheckoutModalOpen(true);
      setPayingId(null);
    } catch (err: any) {
      setPayingId(null);
      console.error('[Payment Error]', err);
      setPayMessage({
        id: booking.id,
        success: false,
        text: `Payment failed: ${err?.response?.data?.message || err?.message || 'Payment initiation failed. Please try again.'}`,
      });
    }
  };

  const handleProcessCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutBooking || !checkoutPaymentData) return;
    setCheckoutError(null);

    // Client-side validations
    if (paymentMethod === 'UPI') {
      const trimmed = upiId.trim();
      if (!trimmed || !trimmed.includes('@') || trimmed.indexOf('@') === 0 || trimmed.endsWith('@')) {
        setCheckoutError('Please enter a valid UPI ID (e.g. name@okhdfcbank or 9876543210@upi).');
        return;
      }
    } else if (paymentMethod === 'CARD') {
      const cleanNumber = cardNumber.replace(/\s+/g, '');
      if (cleanNumber.length !== 16 || !/^\d+$/.test(cleanNumber)) {
        setCheckoutError('Please enter a valid 16-digit card number.');
        return;
      }
      if (!cardholderName.trim()) {
        setCheckoutError('Please enter the cardholder name.');
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        setCheckoutError('Please enter expiry in MM/YY format.');
        return;
      }
      const [mmStr] = cardExpiry.split('/');
      const mm = parseInt(mmStr, 10);
      if (mm < 1 || mm > 12) {
        setCheckoutError('Please enter a valid expiry month (01-12).');
        return;
      }
      if (cardCvv.length < 3 || cardCvv.length > 4 || !/^\d+$/.test(cardCvv)) {
        setCheckoutError('Please enter a valid 3 or 4 digit CVV.');
        return;
      }
    } else if (paymentMethod === 'NETBANKING') {
      if (!bankName) {
        setCheckoutError('Please select your bank.');
        return;
      }
    } else if (paymentMethod === 'WALLET') {
      if (!walletName) {
        setCheckoutError('Please select a wallet.');
        return;
      }
    }

    setCheckoutSubmitting(true);
    try {
      const payload: any = {
        bookingId: checkoutBooking.id,
        paymentId: checkoutPaymentData.paymentId,
        paymentMethod,
      };

      if (paymentMethod === 'UPI') {
        payload.upiId = upiId.trim();
      } else if (paymentMethod === 'CARD') {
        // Never send full card number or CVV
        payload.cardLast4 = cardNumber.replace(/\s+/g, '').slice(-4);
        payload.cardholderName = cardholderName.trim();
      } else if (paymentMethod === 'NETBANKING') {
        payload.bankName = bankName;
      } else if (paymentMethod === 'WALLET') {
        payload.walletName = walletName;
        if (walletPhone) payload.walletPhone = walletPhone;
      }

      await paymentApi.processCheckout(payload);

      setCheckoutModalOpen(false);
      setPayMessage({
        id: checkoutBooking.id,
        success: true,
        text: `Payment of ₹${Number(checkoutPaymentData.amount).toFixed(0)} successful! Booking confirmed.`,
      });

      const updated = await bookingApi.list();
      setBookings(updated.data || []);
      setCheckoutBooking(null);
      setCheckoutPaymentData(null);
    } catch (err: any) {
      setCheckoutError(err?.response?.data?.message || err?.message || 'Payment processing failed. Please try again.');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handleReviewSubmitted = (bookingId: string, review: any) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, review } : b))
    );
  };

  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'UPCOMING') return b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'ACTIVE';
    if (activeTab === 'COMPLETED') return b.status === 'COMPLETED';
    return b.status === 'CANCELLED';
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col sm:row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Charging Sessions</h1>
          <p className="text-sm text-slate-500">Track and manage your EV charging reservations</p>
        </div>
        <Link href="/map">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <Zap className="w-4 h-4" /> Book New Charger
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        {[
          { key: 'UPCOMING', label: 'Upcoming & Active' },
          { key: 'COMPLETED', label: 'Completed' },
          { key: 'CANCELLED', label: 'Cancelled' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === tab.key
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-sm">Fetching bookings...</span>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 p-8 space-y-4">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl mx-auto flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No {activeTab.toLowerCase()} sessions</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Ready to hit the road? Discover available charging points near your route.
          </p>
          <Link href="/map">
            <Button variant="outline" className="text-xs mt-2">
              Browse Available Chargers
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBookings.map((b) => (
            <div key={b.id} className="space-y-2">
              <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 hover:border-slate-300 transition-colors">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        b.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : b.status === 'CONFIRMED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : b.status === 'ACTIVE'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {b.status === 'ACTIVE' && (
                        <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                      )}
                      {b.status}
                    </span>
                    <span className="text-xs text-slate-400">ID: {b.id.slice(0, 8)}</span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">
                    {b.charger?.title || 'EV Charging Point'}
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDate(b.startTime)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                        {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {b.charger?.address && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{b.charger.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 self-end sm:self-center">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Amount</div>
                    <div className="text-lg font-extrabold text-slate-900">{formatCurrency(b.totalAmount)}</div>
                  </div>

                  {/* PENDING: Pay Now and Cancel Booking */}
                  {b.status === 'PENDING' && (
                    confirmCancelId === b.id ? (
                      <div className="flex flex-wrap items-center gap-2 p-2 bg-rose-50 border border-rose-200 rounded-xl">
                        <span className="text-xs font-semibold text-rose-800">Cancel this booking?</span>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => handleCancelBooking(b.id)}
                            disabled={cancellingId === b.id}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                          >
                            {cancellingId === b.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Cancelling...</span>
                              </>
                            ) : (
                              'Cancel Booking'
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmCancelId(null)}
                            disabled={cancellingId === b.id}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-all"
                          >
                            Keep Booking
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handlePayNow(b)}
                          disabled={payingId === b.id || cancellingId === b.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-2 gap-1.5 shadow-sm"
                        >
                          {payingId === b.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Pay Now</span>
                            </>
                          )}
                        </Button>

                        <button
                          type="button"
                          onClick={() => {
                            setPayMessage(null);
                            setConfirmCancelId(b.id);
                          }}
                          disabled={payingId === b.id || cancellingId === b.id}
                          className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel Booking</span>
                        </button>
                      </div>
                    )
                  )}

                  {/* CONFIRMED: Check In and Cancel Booking */}
                  {b.status === 'CONFIRMED' && (
                    confirmCancelId === b.id ? (
                      <div className="flex flex-wrap items-center gap-2 p-2 bg-rose-50 border border-rose-200 rounded-xl">
                        <span className="text-xs font-semibold text-rose-800">Cancel this booking?</span>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => handleCancelBooking(b.id)}
                            disabled={cancellingId === b.id}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                          >
                            {cancellingId === b.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Cancelling...</span>
                              </>
                            ) : (
                              'Cancel Booking'
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmCancelId(null)}
                            disabled={cancellingId === b.id}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-all"
                          >
                            Keep Booking
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleCheckIn(b.id)}
                          disabled={checkingInId === b.id || cancellingId === b.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-2 gap-1.5 shadow-sm"
                        >
                          {checkingInId === b.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Checking In...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Check In</span>
                            </>
                          )}
                        </Button>

                        <button
                          type="button"
                          onClick={() => {
                            setPayMessage(null);
                            setConfirmCancelId(b.id);
                          }}
                          disabled={checkingInId === b.id || cancellingId === b.id}
                          className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel Booking</span>
                        </button>

                        {b.qrCode && (
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl" title="Check-in QR Code">
                            <QrCode className="w-5 h-5 text-slate-700" />
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* ACTIVE: Pulsing Active Badge and Complete Charging */}
                  {b.status === 'ACTIVE' && (
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleCompleteCharging(b.id)}
                        disabled={completingId === b.id}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3.5 py-2 gap-1.5 shadow-sm font-semibold"
                      >
                        {completingId === b.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Completing...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Complete Charging</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* COMPLETED: Summary status */}
                  {b.status === 'COMPLETED' && (
                    <div className="flex flex-col items-end gap-1">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Completed</span>
                      </div>
                      {b.payment && (
                        <span className="text-[11px] text-slate-400">
                          Paid • {b.payment.transactionId ? `Txn: ${b.payment.transactionId.slice(-8)}` : 'Completed'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {payMessage && payMessage.id === b.id && (
                <div
                  className={`-mt-2 p-3 rounded-xl text-xs flex items-center gap-2 ${
                    payMessage.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {payMessage.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  )}
                  <span>{payMessage.text}</span>
                </div>
              )}

              {/* Review Section for Completed Bookings */}
              {b.status === 'COMPLETED' && (
                <BookingReviewSection
                  booking={b}
                  onReviewSubmitted={handleReviewSubmitted}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* VoltShare Fallback Checkout Modal */}
      {checkoutModalOpen && checkoutBooking && checkoutPaymentData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Zap className="w-4 h-4 fill-emerald-600 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Complete Payment</h3>
                  <p className="text-xs text-slate-500">Secure checkout for your EV charging session</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!checkoutSubmitting) {
                    setCheckoutModalOpen(false);
                    setCheckoutBooking(null);
                    setCheckoutPaymentData(null);
                  }
                }}
                disabled={checkoutSubmitting}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Booking Summary Box */}
            <div className="p-6 pb-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Station</span>
                  <span className="text-xs font-bold text-slate-900 truncate max-w-[220px]">
                    {checkoutBooking.charger?.title || 'EV Station'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Date & Slot</span>
                  <span className="font-medium text-slate-800">
                    {formatDate(checkoutBooking.startTime)} ({new Date(checkoutBooking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(checkoutBooking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Total Amount</span>
                  <span className="text-base font-extrabold text-emerald-600">
                    {formatCurrency(checkoutPaymentData.amount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Method Selector Tabs */}
            <div className="px-6 pt-3 pb-1">
              <label className="block text-xs font-bold text-slate-700 mb-2">Select Payment Method</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'UPI', label: 'UPI', icon: Smartphone },
                  { id: 'CARD', label: 'Card', icon: CreditCard },
                  { id: 'NETBANKING', label: 'Net Banking', icon: Building2 },
                  { id: 'WALLET', label: 'Wallet', icon: Wallet },
                ].map((m) => {
                  const Icon = m.icon;
                  const active = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m.id as any);
                        setCheckoutError(null);
                      }}
                      disabled={checkoutSubmitting}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        active
                          ? 'border-emerald-600 bg-emerald-50/70 text-emerald-700 shadow-sm ring-1 ring-emerald-600'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mb-1 ${active ? 'text-emerald-600' : 'text-slate-500'}`} />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Method Form */}
            <form onSubmit={handleProcessCheckout} className="px-6 py-4 space-y-4">
              {paymentMethod === 'UPI' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Virtual Payment Address (UPI ID)
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. yourname@okhdfcbank"
                      disabled={checkoutSubmitting}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  {/* Quick Handle Pills */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500">Quick Handle:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {['@okhdfcbank', '@okaxis', '@oksbi', '@paytm', '@ybl'].map((handle) => (
                        <button
                          key={handle}
                          type="button"
                          disabled={checkoutSubmitting}
                          onClick={() => {
                            const prefix = upiId.includes('@') ? upiId.split('@')[0] : (upiId || 'username');
                            setUpiId(`${prefix}${handle}`);
                          }}
                          className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 rounded-lg transition-colors"
                        >
                          {handle}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'CARD' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Cardholder Name</label>
                    <input
                      type="text"
                      value={cardholderName}
                      onChange={(e) => setCardholderName(e.target.value)}
                      placeholder="Name as printed on card"
                      disabled={checkoutSubmitting}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      maxLength={19}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 16);
                        const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
                        setCardNumber(formatted);
                      }}
                      placeholder="1234 5678 9012 3456"
                      disabled={checkoutSubmitting}
                      className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Expiry (MM/YY)</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        maxLength={5}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '').slice(0, 4);
                          if (val.length >= 3) {
                            val = `${val.slice(0, 2)}/${val.slice(2)}`;
                          }
                          setCardExpiry(val);
                        }}
                        placeholder="MM/YY"
                        disabled={checkoutSubmitting}
                        className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">CVV</label>
                      <input
                        type="password"
                        value={cardCvv}
                        maxLength={4}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="•••"
                        disabled={checkoutSubmitting}
                        className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                    <Lock className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Card details are encrypted. CVV is never stored.</span>
                  </div>
                </div>
              )}

              {paymentMethod === 'NETBANKING' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Select Bank</label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      disabled={checkoutSubmitting}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    >
                      <option value="HDFC Bank">HDFC Bank</option>
                      <option value="State Bank of India">State Bank of India (SBI)</option>
                      <option value="ICICI Bank">ICICI Bank</option>
                      <option value="Axis Bank">Axis Bank</option>
                      <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                      <option value="Punjab National Bank">Punjab National Bank</option>
                      <option value="Bank of Baroda">Bank of Baroda</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500">Popular Banks:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank'].map((b) => (
                        <button
                          key={b}
                          type="button"
                          disabled={checkoutSubmitting}
                          onClick={() => setBankName(b)}
                          className={`px-2 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                            bankName === b
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'WALLET' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Select Wallet</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['PhonePe', 'Paytm', 'Amazon Pay', 'MobiKwik'].map((w) => (
                        <button
                          key={w}
                          type="button"
                          disabled={checkoutSubmitting}
                          onClick={() => setWalletName(w)}
                          className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-left flex items-center justify-between ${
                            walletName === w
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700 font-bold'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>{w}</span>
                          {walletName === w && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Linked Mobile Number</label>
                    <input
                      type="text"
                      value={walletPhone}
                      onChange={(e) => setWalletPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      disabled={checkoutSubmitting}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {checkoutError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={checkoutSubmitting}
                  onClick={() => {
                    setCheckoutModalOpen(false);
                    setCheckoutBooking(null);
                    setCheckoutPaymentData(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={checkoutSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-5 py-2.5 font-bold shadow-sm flex items-center gap-2"
                >
                  {checkoutSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing Payment...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Pay {formatCurrency(checkoutPaymentData.amount)}</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function BookingReviewSection({
  booking,
  onReviewSubmitted,
}: {
  booking: any;
  onReviewSubmitted: (bookingId: string, review: any) => void;
}) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // If already reviewed, display the review card
  if (booking.review) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">Your Review</span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= booking.review.rating
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-200'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-slate-700">{booking.review.rating}/5</span>
          </div>
          {booking.review.createdAt && (
            <span className="text-[11px] text-slate-400">
              {formatDate(booking.review.createdAt)}
            </span>
          )}
        </div>
        {booking.review.comment && (
          <p className="text-xs text-slate-600 italic">"{booking.review.comment}"</p>
        )}
      </div>
    );
  }

  // Do not show review form for unpaid bookings
  if (booking.payment && booking.payment.status !== 'COMPLETED') {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Please select a rating between 1 and 5 stars.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await reviewApi.create({
        bookingId: booking.id,
        rating,
        comment: comment.trim() || undefined,
      });
      setSuccess(true);
      onReviewSubmitted(booking.id, res.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Rate this charger</h4>
          <p className="text-[11px] text-slate-500">How was your charging experience at {booking.charger?.title || 'this station'}?</p>
        </div>
        {/* Star Selection */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              disabled={submitting}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 focus:outline-none transition-transform hover:scale-110"
              title={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              <Star
                className={`w-5 h-5 transition-colors ${
                  star <= (hoverRating || rating)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-300 hover:text-amber-200'
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="text-xs font-bold text-amber-600 ml-1">{rating}/5</span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Thank you! Your review has been submitted.</span>
        </div>
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              placeholder="Share details of your experience (optional, max 500 characters)..."
              disabled={submitting}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none h-16"
            />
            <div className="flex justify-between items-center text-[10px] text-slate-400 px-1">
              <span>Help other EV drivers find reliable chargers</span>
              <span>{comment.length}/500</span>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={submitting || rating === 0}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 gap-1.5 font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Star className="w-3 h-3" />
                  <span>Submit Review</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
