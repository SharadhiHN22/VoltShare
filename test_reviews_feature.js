/**
 * Functional and Security Verification Suite for VoltShare Ratings & Reviews Feature
 */

const http = require('http');

const BASE = 'http://localhost:4000/api';
const TS = Date.now();

const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
}

function request(urlStr, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('='.repeat(70));
  console.log('  VoltShare Ratings & Reviews Feature Verification');
  console.log('='.repeat(70));

  // 1. Setup: Host & Charger
  const rHost = await request(`${BASE}/auth/register`, 'POST', {
    email: `host_rev_${TS}@test.com`,
    password: 'HostPassword123!',
    name: 'Anand Charger Host',
    role: 'HOST',
  });
  const hostToken = rHost.body?.data?.token;

  const rCharger = await request(`${BASE}/chargers`, 'POST', {
    title: `Indiranagar Fast Hub ${TS}`,
    description: 'Fast 60kW DC charging hub',
    address: '100ft Road, Indiranagar, Bangalore',
    latitude: 12.9784,
    longitude: 77.6408,
    chargerType: 'DC_FAST',
    connectorType: 'CCS_2',
    kwRating: 60,
    pricePerKwh: 18,
    pricePerHour: 150,
    availabilityHours: [
      { day: 0, startTime: '00:00', endTime: '23:59' },
      { day: 1, startTime: '00:00', endTime: '23:59' },
      { day: 2, startTime: '00:00', endTime: '23:59' },
      { day: 3, startTime: '00:00', endTime: '23:59' },
      { day: 4, startTime: '00:00', endTime: '23:59' },
      { day: 5, startTime: '00:00', endTime: '23:59' },
      { day: 6, startTime: '00:00', endTime: '23:59' },
    ],
  }, hostToken);
  const chargerId = rCharger.body?.data?.id;
  record('Setup: Charger created by host', rCharger.status === 201 && !!chargerId);

  // 2. Setup: Driver 1 (SEEKER)
  const rDriver1 = await request(`${BASE}/auth/register`, 'POST', {
    email: `driver1_rev_${TS}@test.com`,
    password: 'Driver1Password123!',
    name: 'Vikram EV Driver',
    role: 'SEEKER',
  });
  const driver1Token = rDriver1.body?.data?.token;
  record('Setup: Driver 1 registered', rDriver1.status === 201 && !!driver1Token);

  // 3. Setup: Driver 2 (SEEKER)
  const rDriver2 = await request(`${BASE}/auth/register`, 'POST', {
    email: `driver2_rev_${TS}@test.com`,
    password: 'Driver2Password123!',
    name: 'Meera EV Driver',
    role: 'SEEKER',
  });
  const driver2Token = rDriver2.body?.data?.token;
  record('Setup: Driver 2 registered', rDriver2.status === 201 && !!driver2Token);

  // 4. Create booking for Driver 1
  const start1 = new Date(Date.now() + 3600000).toISOString();
  const end1 = new Date(Date.now() + 7200000).toISOString();
  const rBooking1 = await request(`${BASE}/bookings`, 'POST', {
    chargerId,
    startTime: start1,
    endTime: end1,
  }, driver1Token);
  const booking1Id = rBooking1.body?.data?.id;
  record('Driver 1 creates booking (PENDING)', rBooking1.status === 201 && !!booking1Id);

  // 5. Test review creation on PENDING booking (Must fail)
  const rRevPending = await request(`${BASE}/reviews`, 'POST', {
    bookingId: booking1Id,
    rating: 5,
    comment: 'Great charger!',
  }, driver1Token);
  record(
    'Review rejected for PENDING unpaid booking (400)',
    rRevPending.status === 400,
    `Status ${rRevPending.status}`
  );

  // 6. Pay for booking 1 -> CONFIRMED
  const rPayInit = await request(`${BASE}/payments/initiate`, 'POST', { bookingId: booking1Id }, driver1Token);
  const payment1Id = rPayInit.body?.data?.paymentId;
  const rPayVerify = await request(`${BASE}/payments/verify`, 'POST', {
    paymentId: payment1Id,
    razorpayPaymentId: `rzp_test_${TS}`,
  }, driver1Token);
  record('Driver 1 completes payment for booking (CONFIRMED)', rPayVerify.status === 200);

  // 7. Test review creation on CONFIRMED booking before completion (Must fail)
  const rRevConfirmed = await request(`${BASE}/reviews`, 'POST', {
    bookingId: booking1Id,
    rating: 5,
    comment: 'Charging right now!',
  }, driver1Token);
  record(
    'Review rejected for CONFIRMED incomplete booking (400)',
    rRevConfirmed.status === 400,
    `Status ${rRevConfirmed.status}`
  );

  // 8. Progress booking to ACTIVE then COMPLETED
  await request(`${BASE}/bookings/${booking1Id}/status`, 'PATCH', { status: 'ACTIVE' }, driver1Token);
  const rComplete = await request(`${BASE}/bookings/${booking1Id}/status`, 'PATCH', { status: 'COMPLETED' }, driver1Token);
  record('Booking status updated to COMPLETED', rComplete.status === 200 && rComplete.body?.data?.status === 'COMPLETED');

  // 9. Security: Unauthenticated review attempt blocked
  const rRevUnauth = await request(`${BASE}/reviews`, 'POST', {
    bookingId: booking1Id,
    rating: 5,
  });
  record('Unauthenticated review attempt rejected (401)', rRevUnauth.status === 401);

  // 10. Security: HOST role blocked from submitting review
  const rRevHost = await request(`${BASE}/reviews`, 'POST', {
    bookingId: booking1Id,
    rating: 5,
  }, hostToken);
  record('HOST user blocked from submitting reviews (403)', rRevHost.status === 403);

  // 11. Security: Driver 2 cannot review Driver 1\'s booking
  const rRevTamper = await request(`${BASE}/reviews`, 'POST', {
    bookingId: booking1Id,
    rating: 5,
    comment: 'I did not book this',
  }, driver2Token);
  record(
    'User cannot review another driver\'s booking (403)',
    rRevTamper.status === 403,
    `Status ${rRevTamper.status}`
  );

  // 12. Input validation: Rating < 1 rejected
  const rRevZero = await request(`${BASE}/reviews`, 'POST', {
    bookingId: booking1Id,
    rating: 0,
  }, driver1Token);
  record('Rating < 1 rejected (400)', rRevZero.status === 400);

  // 13. Input validation: Rating > 5 rejected
  const rRevSix = await request(`${BASE}/reviews`, 'POST', {
    bookingId: booking1Id,
    rating: 6,
  }, driver1Token);
  record('Rating > 5 rejected (400)', rRevSix.status === 400);

  // 14. Input validation: Non-integer rating rejected
  const rRevFloat = await request(`${BASE}/reviews`, 'POST', {
    bookingId: booking1Id,
    rating: 4.5,
  }, driver1Token);
  record('Non-integer rating rejected (400)', rRevFloat.status === 400);

  // 15. Input validation: Comment > 500 chars rejected
  const longComment = 'A'.repeat(501);
  const rRevLong = await request(`${BASE}/reviews`, 'POST', {
    bookingId: booking1Id,
    rating: 5,
    comment: longComment,
  }, driver1Token);
  record('Comment exceeding 500 characters rejected (400)', rRevLong.status === 400);

  // 16. Valid Review Submission by Driver 1
  const rRevValid1 = await request(`${BASE}/reviews`, 'POST', {
    bookingId: booking1Id,
    rating: 5,
    comment: 'Super fast DC charging! Clean spot and friendly host.',
  }, driver1Token);
  record(
    'Driver 1 successfully submits review (201)',
    rRevValid1.status === 201 && rRevValid1.body?.data?.rating === 5,
    `Review ID: ${rRevValid1.body?.data?.id}`
  );

  // 17. Duplicate review for the same booking blocked
  const rRevDup = await request(`${BASE}/reviews`, 'POST', {
    bookingId: booking1Id,
    rating: 4,
    comment: 'Trying to review again',
  }, driver1Token);
  record(
    'Duplicate review for same booking blocked (409)',
    rRevDup.status === 409,
    `Status ${rRevDup.status}`
  );

  // 18. Charger stats updated: 1 review of 5 stars -> avg 5.0, total 1
  const rChargerAfter1 = await request(`${BASE}/chargers/${chargerId}`);
  const cData1 = rChargerAfter1.body?.data;
  record(
    'Charger avgRating and totalReviews updated after 1st review',
    Number(cData1?.avgRating) === 5 && cData1?.totalReviews === 1,
    `avgRating: ${cData1?.avgRating}, totalReviews: ${cData1?.totalReviews}`
  );

  // 19. Public reviews endpoint: GET /api/chargers/:id/reviews
  const rChargerReviews = await request(`${BASE}/chargers/${chargerId}/reviews`);
  const revList = rChargerReviews.body?.data;
  const revItem = revList?.[0];
  const noSensitive = revItem && !revItem.reviewer?.password && !revItem.reviewer?.passwordHash && !revItem.reviewer?.email;
  record(
    'GET /api/chargers/:id/reviews returns public reviews without sensitive user fields',
    rChargerReviews.status === 200 && Array.isArray(revList) && revList.length === 1 && noSensitive && revItem.reviewer?.name === 'Vikram EV Driver',
    `Reviewer: ${revItem?.reviewer?.name}, Rating: ${revItem?.rating}`
  );

  // 20. Booking review status check: GET /api/reviews/booking/:bookingId
  const rBookRevStatus = await request(`${BASE}/reviews/booking/${booking1Id}`, 'GET', null, driver1Token);
  record(
    'GET /api/reviews/booking/:id reflects reviewed status (hasReviewed: true, canReview: false)',
    rBookRevStatus.status === 200 && rBookRevStatus.body?.data?.hasReviewed === true && rBookRevStatus.body?.data?.canReview === false
  );

  // 21. Multi-review math test: Driver 2 books, pays, completes and reviews with 3 stars
  const start2 = new Date(Date.now() + 10800000).toISOString();
  const end2 = new Date(Date.now() + 14400000).toISOString();
  const rBooking2 = await request(`${BASE}/bookings`, 'POST', {
    chargerId,
    startTime: start2,
    endTime: end2,
  }, driver2Token);
  const booking2Id = rBooking2.body?.data?.id;

  const rPay2 = await request(`${BASE}/payments/initiate`, 'POST', { bookingId: booking2Id }, driver2Token);
  await request(`${BASE}/payments/verify`, 'POST', {
    paymentId: rPay2.body?.data?.paymentId,
    razorpayPaymentId: `rzp_test_2_${TS}`,
  }, driver2Token);
  await request(`${BASE}/bookings/${booking2Id}/status`, 'PATCH', { status: 'ACTIVE' }, driver2Token);
  await request(`${BASE}/bookings/${booking2Id}/status`, 'PATCH', { status: 'COMPLETED' }, driver2Token);

  const rRevValid2 = await request(`${BASE}/reviews`, 'POST', {
    bookingId: booking2Id,
    rating: 3,
    comment: 'Good speed but tight parking space.',
  }, driver2Token);
  record('Driver 2 submits 3-star review (201)', rRevValid2.status === 201);

  // 22. Verify recalculated average rating: (5 + 3) / 2 = 4.0, totalReviews = 2
  const rChargerAfter2 = await request(`${BASE}/chargers/${chargerId}`);
  const cData2 = rChargerAfter2.body?.data;
  record(
    'Charger recalculated avgRating = 4.0 and totalReviews = 2',
    Number(cData2?.avgRating) === 4 && cData2?.totalReviews === 2,
    `avgRating: ${cData2?.avgRating}, totalReviews: ${cData2?.totalReviews}`
  );

  // 23. Host cannot review own charger
  const rHostOwnRev = await request(`${BASE}/reviews`, 'POST', {
    bookingId: booking1Id,
    rating: 5,
  }, hostToken);
  record('Host cannot review charger (403)', rHostOwnRev.status === 403);

  // 24. Driver bookings list includes review status
  const rDriverBookings = await request(`${BASE}/bookings`, 'GET', null, driver1Token);
  const bList = rDriverBookings.body?.data;
  const b1 = bList?.find((b) => b.id === booking1Id);
  record(
    'Driver bookings endpoint includes review and payment data',
    !!b1 && !!b1.review && b1.review.rating === 5 && !!b1.payment,
    `Review rating in booking: ${b1?.review?.rating}`
  );

  console.log('='.repeat(70));
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`Results: ${passed} Passed, ${failed} Failed out of ${results.length} tests.`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
