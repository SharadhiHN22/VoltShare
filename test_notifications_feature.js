/**
 * Functional and Security Verification Suite for VoltShare In-App Notifications Feature
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
  console.log('  VoltShare Notifications Feature & Security Verification');
  console.log('='.repeat(70));

  // 1. Security: Unauthenticated access blocked
  const rUnauthList = await request(`${BASE}/notifications`);
  record('1. Unauthenticated GET /notifications blocked (401)', rUnauthList.status === 401);

  const rUnauthCount = await request(`${BASE}/notifications/unread-count`);
  record('2. Unauthenticated GET /notifications/unread-count blocked (401)', rUnauthCount.status === 401);

  const rUnauthRead = await request(`${BASE}/notifications/any-id/read`, 'PATCH');
  record('3. Unauthenticated PATCH /notifications/:id/read blocked (401)', rUnauthRead.status === 401);

  const rUnauthReadAll = await request(`${BASE}/notifications/read-all`, 'PATCH');
  record('4. Unauthenticated PATCH /notifications/read-all blocked (401)', rUnauthReadAll.status === 401);

  // 2. Setup: Host & Charger
  const rHost = await request(`${BASE}/auth/register`, 'POST', {
    email: `host_notif_${TS}@test.com`,
    password: 'HostPass123!',
    name: 'Ramesh Host',
    role: 'HOST',
  });
  const hostToken = rHost.body?.data?.token;
  const hostId = rHost.body?.data?.user?.id;

  const rCharger = await request(`${BASE}/chargers`, 'POST', {
    title: `Koramangala Hub ${TS}`,
    description: 'Fast 50kW charging hub',
    address: '80ft Road, Koramangala 4th Block, Bangalore',
    latitude: 12.9352,
    longitude: 77.6245,
    chargerType: 'DC_FAST',
    connectorType: 'CCS_2',
    kwRating: 50,
    pricePerKwh: 16,
    pricePerHour: 120,
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

  // 3. Setup: Driver 1 (SEEKER)
  const rDriver1 = await request(`${BASE}/auth/register`, 'POST', {
    email: `driver_notif_${TS}@test.com`,
    password: 'DriverPass123!',
    name: 'Suresh EV Driver',
    role: 'SEEKER',
  });
  const driver1Token = rDriver1.body?.data?.token;
  const driver1Id = rDriver1.body?.data?.user?.id;

  // 4. Initial state: Both have 0 notifications
  const rInitDriver = await request(`${BASE}/notifications`, 'GET', null, driver1Token);
  record('5. New driver initially has 0 notifications', rInitDriver.status === 200 && rInitDriver.body?.unreadCount === 0);

  const rInitHost = await request(`${BASE}/notifications`, 'GET', null, hostToken);
  record('6. New host initially has 0 notifications', rInitHost.status === 200 && rInitHost.body?.unreadCount === 0);

  // 5. Driver creates and pays for a booking
  const start1 = new Date(Date.now() + 7200000).toISOString();
  const end1 = new Date(Date.now() + 10800000).toISOString();
  const rBooking1 = await request(`${BASE}/bookings`, 'POST', {
    chargerId,
    startTime: start1,
    endTime: end1,
  }, driver1Token);
  const booking1Id = rBooking1.body?.data?.id;

  const rPayInit = await request(`${BASE}/payments/initiate`, 'POST', { bookingId: booking1Id }, driver1Token);
  const payment1Id = rPayInit.body?.data?.paymentId;

  const rPayVerify = await request(`${BASE}/payments/verify`, 'POST', {
    paymentId: payment1Id,
    razorpayPaymentId: `rzp_notif_${TS}`,
  }, driver1Token);
  record('7. Payment successfully verified', rPayVerify.status === 200);

  // 6. Verify Driver Notifications after Payment
  const rDriverNotifsAfterPay = await request(`${BASE}/notifications`, 'GET', null, driver1Token);
  const dNotifs = rDriverNotifsAfterPay.body?.data || [];
  const hasBookingConfirmed = dNotifs.some(n => n.type === 'BOOKING_CONFIRMED' && n.title === 'Booking confirmed');
  const hasPaymentSuccess = dNotifs.some(n => n.type === 'PAYMENT_SUCCESS' && n.title === 'Payment successful');
  record(
    '8. Driver receives "Booking confirmed" notification',
    hasBookingConfirmed,
    `Found: ${hasBookingConfirmed}`
  );
  record(
    '9. Driver receives "Payment successful" notification',
    hasPaymentSuccess,
    `Found: ${hasPaymentSuccess}`
  );
  record(
    '10. Driver unread notification count is 2',
    rDriverNotifsAfterPay.body?.unreadCount === 2,
    `unreadCount=${rDriverNotifsAfterPay.body?.unreadCount}`
  );

  // 7. Verify Host Notification after Payment
  const rHostNotifsAfterPay = await request(`${BASE}/notifications`, 'GET', null, hostToken);
  const hNotifs = rHostNotifsAfterPay.body?.data || [];
  const hasNewBooking = hNotifs.some(n => n.type === 'NEW_BOOKING' && n.title === 'New booking received');
  record(
    '11. Host receives "New booking received" notification',
    hasNewBooking,
    `Found: ${hasNewBooking}`
  );
  record(
    '12. Host unread notification count is 1',
    rHostNotifsAfterPay.body?.unreadCount === 1,
    `unreadCount=${rHostNotifsAfterPay.body?.unreadCount}`
  );

  // 8. Data Isolation: Driver cannot see Host notifications, Host cannot see Driver notifications
  const driverSeesHostNotifs = dNotifs.some(n => n.userId === hostId);
  const hostSeesDriverNotifs = hNotifs.some(n => n.userId === driver1Id);
  record('13. User data isolation: Driver cannot see host notifications', !driverSeesHostNotifs);
  record('14. User data isolation: Host cannot see driver notifications', !hostSeesDriverNotifs);

  // 9. Security: User cannot mark another user\'s notification as read
  const hostNotifId = hNotifs[0]?.id;
  const driverNotifId = dNotifs[0]?.id;

  const rTamperDriver = await request(`${BASE}/notifications/${hostNotifId}/read`, 'PATCH', {}, driver1Token);
  record('15. Security: Driver cannot mark Host notification as read (403)', rTamperDriver.status === 403);

  const rTamperHost = await request(`${BASE}/notifications/${driverNotifId}/read`, 'PATCH', {}, hostToken);
  record('16. Security: Host cannot mark Driver notification as read (403)', rTamperHost.status === 403);

  // 10. Duplicate Prevention: Verify payment or webhook again does not duplicate notifications
  await request(`${BASE}/payments/verify`, 'POST', {
    paymentId: payment1Id,
    razorpayPaymentId: `rzp_notif_dup_${TS}`,
  }, driver1Token);
  const rDriverNotifsAfterDup = await request(`${BASE}/notifications`, 'GET', null, driver1Token);
  record(
    '17. Duplicate event processing does not create duplicate notifications',
    rDriverNotifsAfterDup.body?.data?.length === 2,
    `Count=${rDriverNotifsAfterDup.body?.data?.length} (expected 2)`
  );

  // 11. Mark a Single Notification as Read
  const rMarkSingle = await request(`${BASE}/notifications/${driverNotifId}/read`, 'PATCH', {}, driver1Token);
  record(
    '18. Driver marks single notification as read (200 OK)',
    rMarkSingle.status === 200 && rMarkSingle.body?.data?.isRead === true
  );

  const rCountAfterSingle = await request(`${BASE}/notifications/unread-count`, 'GET', null, driver1Token);
  record(
    '19. Unread count decremented to 1',
    rCountAfterSingle.body?.data?.unreadCount === 1,
    `unreadCount=${rCountAfterSingle.body?.data?.unreadCount}`
  );

  // 12. Mark All Notifications as Read
  const rMarkAll = await request(`${BASE}/notifications/read-all`, 'PATCH', {}, driver1Token);
  record('20. Driver marks all notifications as read (200 OK)', rMarkAll.status === 200);

  const rCountAfterAll = await request(`${BASE}/notifications/unread-count`, 'GET', null, driver1Token);
  record(
    '21. Unread count became 0',
    rCountAfterAll.body?.data?.unreadCount === 0,
    `unreadCount=${rCountAfterAll.body?.data?.unreadCount}`
  );

  // 13. Booking Completion Notification
  await request(`${BASE}/bookings/${booking1Id}/status`, 'PATCH', { status: 'ACTIVE' }, driver1Token);
  await request(`${BASE}/bookings/${booking1Id}/status`, 'PATCH', { status: 'COMPLETED' }, driver1Token);

  const rDriverNotifsAfterComplete = await request(`${BASE}/notifications`, 'GET', null, driver1Token);
  const dNotifsAfterComplete = rDriverNotifsAfterComplete.body?.data || [];
  const hasChargingCompleted = dNotifsAfterComplete.some(
    n => n.type === 'CHARGING_COMPLETED' && n.title === 'Charging completed'
  );
  record(
    '22. Driver receives "Charging completed" notification on session finish',
    hasChargingCompleted,
    `Found: ${hasChargingCompleted}`
  );

  // 14. Booking Cancellation Notification (notifies both driver and host)
  const start2 = new Date(Date.now() + 18000000).toISOString();
  const end2 = new Date(Date.now() + 21600000).toISOString();
  const rBooking2 = await request(`${BASE}/bookings`, 'POST', {
    chargerId,
    startTime: start2,
    endTime: end2,
  }, driver1Token);
  const booking2Id = rBooking2.body?.data?.id;

  // Cancel booking
  await request(`${BASE}/bookings/${booking2Id}/status`, 'PATCH', { status: 'CANCELLED' }, driver1Token);

  const rDriverAfterCancel = await request(`${BASE}/notifications`, 'GET', null, driver1Token);
  const hasDriverCancel = (rDriverAfterCancel.body?.data || []).some(
    n => n.type === 'BOOKING_CANCELLED' && n.title === 'Booking cancelled'
  );
  record('23. Driver receives "Booking cancelled" notification', hasDriverCancel);

  const rHostAfterCancel = await request(`${BASE}/notifications`, 'GET', null, hostToken);
  const hasHostCancel = (rHostAfterCancel.body?.data || []).some(
    n => n.type === 'BOOKING_CANCELLED' && n.title === 'Booking cancelled'
  );
  record('24. Host receives "Booking cancelled" notification', hasHostCancel);

  // 15. Check Frontend /notifications Route
  const rWebNotifs = await request('http://localhost:3000/notifications');
  record('25. Frontend /notifications route is accessible (200 OK)', rWebNotifs.status === 200);

  console.log('='.repeat(70));
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`Results: ${passed} Passed, ${failed} Failed out of ${results.length} tests.`);
  console.log('='.repeat(70));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
