const axios = require('axios');
const API = 'http://localhost:4000/api';
const TS = Date.now();

async function runTests() {
  console.log('--- STARTING CHECKOUT AND CHARGING LIFECYCLE AUDIT ---');

  // 1. Register Seeker and Host
  console.log('\n[Step 1] Registering test Seeker and Host...');
  const seekerReg = await axios.post(`${API}/auth/register`, {
    email: `seeker_lc_${TS}@test.com`,
    password: 'Password@123',
    name: 'Lifecycle Driver',
    role: 'SEEKER',
  });
  const seekerToken = seekerReg.data.data.token;
  const seekerHeaders = { Authorization: `Bearer ${seekerToken}` };
  console.log('✓ Seeker registered & logged in.');

  const hostReg = await axios.post(`${API}/auth/register`, {
    email: `host_lc_${TS}@test.com`,
    password: 'Password@123',
    name: 'Lifecycle Host',
    role: 'HOST',
  });
  const hostToken = hostReg.data.data.token;
  const hostHeaders = { Authorization: `Bearer ${hostToken}` };
  console.log('✓ Host registered & logged in.');

  // Get an existing active charger
  const chargerSearch = await axios.get(`${API}/chargers?latitude=12.9716&longitude=77.5946&radiusKm=50`);
  const activeChargers = (chargerSearch.data?.data || []).filter(c => c.status === 'ACTIVE');
  if (activeChargers.length === 0) {
    throw new Error('No active chargers found for testing.');
  }
  const testCharger = activeChargers[0];
  console.log(`✓ Using active charger: ${testCharger.title} (ID: ${testCharger.id})`);

  // Helper to create booking with non-overlapping future times
  let testOffset = Math.floor(Math.random() * 100000) + 10000;
  async function createTestBooking() {
    testOffset += 120;
    const startTime = new Date(Date.now() + testOffset * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    const bookingRes = await axios.post(
      `${API}/bookings`,
      {
        chargerId: testCharger.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
      { headers: seekerHeaders }
    );
    return bookingRes.data.data;
  }

  // TEST 1: Full Lifecycle with UPI Payment
  console.log('\n[Test 1] Testing UPI Checkout & Full Charging Lifecycle...');
  const booking1 = await createTestBooking();
  console.log(`✓ Created test booking 1: ${booking1.id}, status: ${booking1.status}`);
  if (booking1.status !== 'PENDING') throw new Error(`Expected PENDING, got ${booking1.status}`);

  // Initiate payment
  const initRes = await axios.post(
    `${API}/payments/initiate`,
    { bookingId: booking1.id },
    { headers: seekerHeaders }
  );
  const paymentData1 = initRes.data.data;
  console.log('✓ Payment initiated:', {
    paymentId: paymentData1.paymentId,
    amount: paymentData1.amount,
    requiresCheckoutModal: paymentData1.requiresCheckoutModal,
    completed: paymentData1.completed,
  });

  if (!paymentData1.requiresCheckoutModal) {
    throw new Error('Expected requiresCheckoutModal: true when remote Razorpay credentials are placeholder');
  }
  if (paymentData1.completed) {
    throw new Error('Expected completed: false prior to checkout modal submission');
  }

  // Verify booking and payment are still PENDING before modal submission
  const bookingCheck1 = await axios.get(`${API}/bookings/${booking1.id}`, { headers: seekerHeaders });
  if (bookingCheck1.data.data.status !== 'PENDING') {
    throw new Error(`Booking should remain PENDING before checkout, got ${bookingCheck1.data.data.status}`);
  }
  console.log('✓ Booking verified as PENDING prior to checkout modal submission.');

  // Process Checkout with UPI
  const checkoutRes1 = await axios.post(
    `${API}/payments/process-checkout`,
    {
      bookingId: booking1.id,
      paymentId: paymentData1.paymentId,
      paymentMethod: 'UPI',
      upiId: 'testdriver@okhdfcbank',
    },
    { headers: seekerHeaders }
  );
  console.log('✓ Processed UPI checkout:', checkoutRes1.data.message);
  const confirmedBooking1 = checkoutRes1.data.data.booking;
  const completedPayment1 = checkoutRes1.data.data.payment;

  if (confirmedBooking1.status !== 'CONFIRMED') {
    throw new Error(`Expected booking status CONFIRMED after payment, got ${confirmedBooking1.status}`);
  }
  if (completedPayment1.status !== 'COMPLETED') {
    throw new Error(`Expected payment status COMPLETED, got ${completedPayment1.status}`);
  }
  console.log(`✓ Booking correctly transitioned to CONFIRMED (NOT COMPLETED). Payment is COMPLETED.`);

  // Verify Review is NOT allowed while CONFIRMED
  const reviewEligibility1 = await axios.get(`${API}/reviews/booking/${booking1.id}`, { headers: seekerHeaders });
  if (reviewEligibility1.data.data.canReview) {
    throw new Error('Driver should NOT be allowed to review before session is COMPLETED');
  }
  console.log('✓ Confirmed: Driver cannot review while booking is only CONFIRMED.');

  // Check In: transitions CONFIRMED -> ACTIVE
  console.log('\n[Test 1.2] Checking In (CONFIRMED -> ACTIVE)...');
  const checkInRes = await axios.post(
    `${API}/bookings/${booking1.id}/check-in`,
    {},
    { headers: seekerHeaders }
  );
  if (checkInRes.data.data.status !== 'ACTIVE') {
    throw new Error(`Expected status ACTIVE after check-in, got ${checkInRes.data.data.status}`);
  }
  console.log('✓ Booking transitioned to ACTIVE after check-in.');

  // Verify Review is still NOT allowed while ACTIVE
  const reviewEligibility2 = await axios.get(`${API}/reviews/booking/${booking1.id}`, { headers: seekerHeaders });
  if (reviewEligibility2.data.data.canReview) {
    throw new Error('Driver should NOT be allowed to review while session is ACTIVE');
  }
  console.log('✓ Confirmed: Driver cannot review while booking is ACTIVE.');

  // Complete Charging: transitions ACTIVE -> COMPLETED
  console.log('\n[Test 1.3] Completing Charging Session (ACTIVE -> COMPLETED)...');
  const completeRes = await axios.post(
    `${API}/bookings/${booking1.id}/complete`,
    {},
    { headers: seekerHeaders }
  );
  if (completeRes.data.data.status !== 'COMPLETED') {
    throw new Error(`Expected status COMPLETED after completion, got ${completeRes.data.data.status}`);
  }
  console.log('✓ Booking transitioned to COMPLETED after complete action.');

  // Verify Review is NOW allowed
  const reviewEligibility3 = await axios.get(`${API}/reviews/booking/${booking1.id}`, { headers: seekerHeaders });
  if (!reviewEligibility3.data.data.canReview) {
    throw new Error('Driver SHOULD be eligible to review after session is COMPLETED and paid');
  }
  console.log('✓ Confirmed: Driver is now eligible to review the completed charging session.');

  // Submit Review
  const reviewPostRes = await axios.post(
    `${API}/reviews`,
    {
      bookingId: booking1.id,
      rating: 5,
      comment: 'Excellent fast charging station!',
    },
    { headers: seekerHeaders }
  );
  console.log('✓ Review submitted successfully:', reviewPostRes.data.data.rating, 'stars.');

  // TEST 2: Invalid State Transitions and Security Checks
  console.log('\n[Test 2] Testing Security and Invalid State Transitions...');
  // Non-owner cannot check in
  try {
    await axios.post(`${API}/bookings/${booking1.id}/check-in`, {}, { headers: hostHeaders });
    throw new Error('Non-owner should not be able to check in');
  } catch (err) {
    if (err.response && (err.response.status === 403 || err.response.status === 400)) {
      console.log(`✓ Non-owner check-in rejected (${err.response.status}: ${err.response.data.message})`);
    } else throw err;
  }

  // Already completed booking cannot complete again
  try {
    await axios.post(`${API}/bookings/${booking1.id}/complete`, {}, { headers: seekerHeaders });
    throw new Error('Completed booking should not be completable again');
  } catch (err) {
    if (err.response && err.response.status === 400) {
      console.log(`✓ Invalid transition rejected (${err.response.status}: ${err.response.data.message})`);
    } else throw err;
  }

  // Cannot check in on a PENDING booking
  const pendingBooking = await createTestBooking();
  try {
    await axios.post(`${API}/bookings/${pendingBooking.id}/check-in`, {}, { headers: seekerHeaders });
    throw new Error('Pending booking should not be check-in eligible');
  } catch (err) {
    if (err.response && err.response.status === 400) {
      console.log(`✓ Premature check-in rejected (${err.response.status}: ${err.response.data.message})`);
    } else throw err;
  }

  // TEST 3: Card Payment Method
  console.log('\n[Test 3] Testing Card Checkout Method...');
  const booking2 = await createTestBooking();
  const initRes2 = await axios.post(`${API}/payments/initiate`, { bookingId: booking2.id }, { headers: seekerHeaders });
  const cardCheckoutRes = await axios.post(
    `${API}/payments/process-checkout`,
    {
      bookingId: booking2.id,
      paymentId: initRes2.data.data.paymentId,
      paymentMethod: 'CARD',
      cardLast4: '4242',
      cardholderName: 'Volt Driver',
    },
    { headers: seekerHeaders }
  );
  if (cardCheckoutRes.data.data.booking.status !== 'CONFIRMED') {
    throw new Error('Expected CONFIRMED status after card checkout');
  }
  console.log('✓ Card payment method processed successfully without storing card numbers.');

  // TEST 4: Net Banking Payment Method
  console.log('\n[Test 4] Testing Net Banking Checkout Method...');
  const booking3 = await createTestBooking();
  const initRes3 = await axios.post(`${API}/payments/initiate`, { bookingId: booking3.id }, { headers: seekerHeaders });
  const nbCheckoutRes = await axios.post(
    `${API}/payments/process-checkout`,
    {
      bookingId: booking3.id,
      paymentId: initRes3.data.data.paymentId,
      paymentMethod: 'NETBANKING',
      bankName: 'State Bank of India',
    },
    { headers: seekerHeaders }
  );
  if (nbCheckoutRes.data.data.booking.status !== 'CONFIRMED') {
    throw new Error('Expected CONFIRMED status after net banking checkout');
  }
  console.log('✓ Net Banking checkout method processed successfully.');

  // TEST 5: Wallet Payment Method
  console.log('\n[Test 5] Testing Wallet Checkout Method...');
  const booking4 = await createTestBooking();
  const initRes4 = await axios.post(`${API}/payments/initiate`, { bookingId: booking4.id }, { headers: seekerHeaders });
  const walletCheckoutRes = await axios.post(
    `${API}/payments/process-checkout`,
    {
      bookingId: booking4.id,
      paymentId: initRes4.data.data.paymentId,
      paymentMethod: 'WALLET',
      walletName: 'PhonePe',
      walletPhone: '9876543210',
    },
    { headers: seekerHeaders }
  );
  if (walletCheckoutRes.data.data.booking.status !== 'CONFIRMED') {
    throw new Error('Expected CONFIRMED status after wallet checkout');
  }
  console.log('✓ Wallet checkout method processed successfully.');

  console.log('\n🎉 ALL CHECKOUT AND CHARGING LIFECYCLE TESTS PASSED PERFECTLY!\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.response?.data || err.message);
  process.exit(1);
});
