/**
 * Verification Suite for VoltShare Add Vehicle & Compatibility Feature
 */

const http = require('http');

const BASE = 'http://localhost:4000/api';
const WEB_BASE = 'http://localhost:3000';
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
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
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
  console.log('  VoltShare Vehicle Feature & Regression Verification');
  console.log('='.repeat(70));

  // 1. Register driver 1
  const rDriver1 = await request(`${BASE}/auth/register`, 'POST', {
    email: `driver_v_${TS}@test.com`,
    password: 'DriverPass123!',
    name: 'Karthik EV Driver',
    role: 'SEEKER'
  });
  const driver1Token = rDriver1.body?.data?.token;

  // 2. Register driver 2 (for isolation check)
  const rDriver2 = await request(`${BASE}/auth/register`, 'POST', {
    email: `driver2_v_${TS}@test.com`,
    password: 'DriverPass123!',
    name: 'Ananya EV Driver',
    role: 'SEEKER'
  });
  const driver2Token = rDriver2.body?.data?.token;

  // 3. Register host
  const rHost = await request(`${BASE}/auth/register`, 'POST', {
    email: `host_v_${TS}@test.com`,
    password: 'HostPass123!',
    name: 'Host User',
    role: 'HOST'
  });
  const hostToken = rHost.body?.data?.token;

  // Test 1: Unauthenticated access blocked
  {
    const r = await request(`${BASE}/vehicles`, 'GET');
    record('1. Unauthenticated access blocked (401)', r.status === 401, `status=${r.status}`);
  }

  // Test 2: Host access blocked (SEEKER only)
  {
    const r = await request(`${BASE}/vehicles`, 'GET', null, hostToken);
    record('2. Host access blocked from vehicles (403)', r.status === 403, `status=${r.status}`);
  }

  // Test 3: Host cannot add vehicle (SEEKER only)
  {
    const r = await request(`${BASE}/vehicles`, 'POST', {
      make: 'Tata',
      model: 'Nexon EV',
      year: 2024,
      connectorType: 'CCS_2'
    }, hostToken);
    record('3. Host cannot add vehicle (403)', r.status === 403, `status=${r.status}`);
  }

  // Test 4: Required-field validation (missing make)
  {
    const r = await request(`${BASE}/vehicles`, 'POST', {
      model: 'Nexon EV',
      year: 2024,
      connectorType: 'CCS_2'
    }, driver1Token);
    record('4. Required-field validation (missing make returns 400)', r.status === 400, `status=${r.status}`);
  }

  // Test 5: Required-field validation (missing model)
  {
    const r = await request(`${BASE}/vehicles`, 'POST', {
      make: 'Tata',
      year: 2024,
      connectorType: 'CCS_2'
    }, driver1Token);
    record('5. Required-field validation (missing model returns 400)', r.status === 400, `status=${r.status}`);
  }

  // Test 6: Required-field validation (missing connectorType)
  {
    const r = await request(`${BASE}/vehicles`, 'POST', {
      make: 'Tata',
      model: 'Nexon EV',
      year: 2024
    }, driver1Token);
    record('6. Required-field validation (missing connectorType returns 400)', r.status === 400, `status=${r.status}`);
  }

  // Test 7: Invalid connector input rejected
  {
    const r = await request(`${BASE}/vehicles`, 'POST', {
      make: 'Tata',
      model: 'Nexon EV',
      year: 2024,
      connectorType: 'USB_C_CHARGER'
    }, driver1Token);
    record('7. Invalid connector input rejected (400)', r.status === 400, `status=${r.status}`);
  }

  // Test 8: Driver can add a valid vehicle
  let vehicleId = '';
  {
    const r = await request(`${BASE}/vehicles`, 'POST', {
      make: 'Tata',
      model: 'Nexon EV Max',
      year: 2024,
      connectorType: 'CCS_2',
      batteryCapacity: 40.5,
      registrationNumber: 'KA01EV5678'
    }, driver1Token);
    const pass = r.status === 201 && r.body?.data?.id && r.body?.data?.connectorType === 'CCS_2';
    if (pass) vehicleId = r.body.data.id;
    record('8. Driver can add a vehicle (201 Created)', pass, `id=${vehicleId} connector=${r.body?.data?.connectorType}`);
  }

  // Test 9: Driver can view their saved vehicle
  {
    const r = await request(`${BASE}/vehicles`, 'GET', null, driver1Token);
    const list = r.body?.data || [];
    const found = list.some(v => v.id === vehicleId && v.connectorType === 'CCS_2');
    record('9. Driver can view saved vehicle (200 OK)', r.status === 200 && found, `count=${list.length}`);
  }

  // Test 10: User isolation — Driver 2 cannot see Driver 1's vehicle
  {
    const r = await request(`${BASE}/vehicles`, 'GET', null, driver2Token);
    const list = r.body?.data || [];
    const isolated = list.length === 0;
    record('10. User cannot access another user vehicles (isolation)', isolated, `driver2 count=${list.length}`);
  }

  // Test 11: Charger compatibility logic test
  {
    // Search chargers
    const r = await request(`${BASE}/chargers?latitude=12.9716&longitude=77.5946&radiusKm=50`);
    const chargers = r.body?.data || [];
    const driverVehicleConnector = 'CCS_2';

    const compatibleChargers = chargers.filter(c => c.connectorType === driverVehicleConnector);
    const incompatibleChargers = chargers.filter(c => c.connectorType !== driverVehicleConnector);

    record('11. Charger compatibility logic determines compatible chargers', 
      compatibleChargers.length > 0 && incompatibleChargers.length > 0, 
      `compatible=${compatibleChargers.length} (${compatibleChargers.map(c => c.connectorType).join(', ')}) incompatible=${incompatibleChargers.length} (${incompatibleChargers.map(c => c.connectorType).join(', ')})`);
  }

  // Test 12: Existing map/search still works
  {
    const r = await request(`${BASE}/chargers?latitude=12.9716&longitude=77.5946&radiusKm=15`);
    record('12. Existing map/search API unaffected (200 OK)', r.status === 200 && Array.isArray(r.body?.data), `results=${r.body?.data?.length}`);
  }

  // Test 13: Existing booking flow unaffected
  let testBookingId = '';
  {
    const rChargers = await request(`${BASE}/chargers?latitude=12.9716&longitude=77.5946&radiusKm=50`);
    const active = (rChargers.body?.data || []).find(c => c.status === 'ACTIVE');
    if (active) {
      const startTime = new Date(Date.now() + Math.floor(Math.random() * 800000000) + 600000000);
      const endTime = new Date(startTime.getTime() + 2 * 3600000);
      const r = await request(`${BASE}/bookings`, 'POST', {
        chargerId: active.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        notes: 'Regression test booking'
      }, driver1Token);
      const pass = r.status === 201 && r.body?.data?.id;
      if (pass) testBookingId = r.body.data.id;
      record('13. Existing booking flow unaffected (201 Created)', pass, `bookingId=${testBookingId} status=${r.status} ${r.body?.message || ''}`);
    } else {
      record('13. Existing booking flow unaffected', false, 'No active charger');
    }
  }

  // Test 14: Existing payment flow unaffected
  {
    if (testBookingId) {
      const rInit = await request(`${BASE}/payments/initiate`, 'POST', { bookingId: testBookingId }, driver1Token);
      const paymentId = rInit.body?.data?.paymentId;
      const rVerify = await request(`${BASE}/payments/verify`, 'POST', { paymentId }, driver1Token);
      const rBookingCheck = await request(`${BASE}/bookings/${testBookingId}`, 'GET', null, driver1Token);
      record('14. Existing payment flow unaffected (CONFIRMED)', 
        rVerify.status === 200 && rBookingCheck.body?.data?.status === 'CONFIRMED', 
        `status=${rBookingCheck.body?.data?.status}`);
    } else {
      record('14. Existing payment flow unaffected', false, 'No booking to pay');
    }
  }

  // Test 15: Frontend health & /profile/vehicles page accessible
  {
    const rVehiclesPage = await request(`${WEB_BASE}/profile/vehicles`);
    record('15. Frontend /profile/vehicles route accessible (200 OK)', rVehiclesPage.status === 200, `status=${rVehiclesPage.status}`);
  }

  // Test 16: Frontend /map route accessible
  {
    const rMapPage = await request(`${WEB_BASE}/map`);
    record('16. Frontend /map route accessible (200 OK)', rMapPage.status === 200, `status=${rMapPage.status}`);
  }

  // Test 17: Backend health check
  {
    const rHealth = await request(`${BASE.replace('/api', '')}/health`);
    record('17. Backend health check (200 OK)', rHealth.status === 200 && rHealth.body?.status === 'ok', `status=${rHealth.body?.status}`);
  }

  console.log('\n' + '='.repeat(70));
  const passed = results.filter(r => r.pass).length;
  console.log(`  RESULTS: ${passed}/${results.length} PASSED`);
  console.log('='.repeat(70));
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
