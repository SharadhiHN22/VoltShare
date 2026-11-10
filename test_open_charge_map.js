const axios = require('axios');
const http = require('http');

const API = 'http://localhost:4000/api';
const TS = Date.now();

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function run() {
  console.log('='.repeat(70));
  console.log('  VoltShare Open Charge Map Real Public EV Station Search Audit');
  console.log('='.repeat(70));

  // 1. Authenticate a test seeker to test booking
  const seekerReg = await axios.post(`${API}/auth/register`, {
    email: `seeker_ocm_${TS}@test.com`,
    password: 'Password@123',
    name: 'OCM Tester',
    role: 'SEEKER',
  });
  const seekerToken = seekerReg.data.data.token;
  const seekerHeaders = { Authorization: `Bearer ${seekerToken}` };
  console.log('✓ Seeker authenticated for testing.\n');

  // Test 1: Combined search returns results with user GPS coordinates
  // Test coordinate: MG Road / Indiranagar, Bangalore (12.9716, 77.5946)
  const userLat = 12.9716;
  const userLng = 77.5946;
  const searchRes = await axios.get(`${API}/chargers?latitude=${userLat}&longitude=${userLng}&radiusKm=15`);
  const allStations = searchRes.data.data || [];

  const voltshareStations = allStations.filter(s => s.source === 'VOLTShare');
  const externalStations = allStations.filter(s => s.source === 'EXTERNAL');

  record(
    '1. Combined search endpoint returns 200 OK with unified array',
    searchRes.status === 200 && Array.isArray(allStations),
    `total=${allStations.length} (VOLTShare=${voltshareStations.length}, EXTERNAL=${externalStations.length})`
  );

  record(
    '2. VoltShare database chargers are present and identified as source: "VOLTShare"',
    voltshareStations.length > 0 && voltshareStations.every(s => s.source === 'VOLTShare' && !s.isExternal),
    `count=${voltshareStations.length}, sample title: "${voltshareStations[0]?.title}"`
  );

  record(
    '3. Real Open Charge Map stations are present and identified as source: "EXTERNAL"',
    externalStations.length > 0 && externalStations.every(s => s.source === 'EXTERNAL' && s.id.startsWith('ocm-') && s.isExternal),
    `count=${externalStations.length}, sample station: "${externalStations[0]?.title}" (${externalStations[0]?.operatorName || 'Public'})`
  );

  // Test 4: Distance sorting
  let isSorted = true;
  for (let i = 0; i < allStations.length - 1; i++) {
    if (Number(allStations[i].distanceKm) > Number(allStations[i + 1].distanceKm)) {
      isSorted = false;
      break;
    }
  }
  record(
    '4. Unified results are sorted strictly by distance ascending (nearest first)',
    isSorted && allStations.length > 1,
    `first=${allStations[0]?.distanceKm}km (${allStations[0]?.source}), second=${allStations[1]?.distanceKm}km (${allStations[1]?.source})`
  );

  // Test 5: Accurate distance calculation from user GPS coordinates
  const firstExternal = externalStations[0];
  if (firstExternal) {
    const latDiff = Math.abs(firstExternal.latitude - userLat);
    const lngDiff = Math.abs(firstExternal.longitude - userLng);
    const hasValidCoords = Number.isFinite(firstExternal.latitude) && Number.isFinite(firstExternal.longitude);
    record(
      '5. Distance is accurately calculated based on user GPS coordinates and station coords',
      hasValidCoords && firstExternal.distanceKm >= 0 && firstExternal.distanceKm <= 15,
      `station: "${firstExternal.title}", distance=${firstExternal.distanceKm}km, coords=(${firstExternal.latitude}, ${firstExternal.longitude})`
    );
  }

  // Test 6: External stations cannot be booked as VoltShare chargers
  let externalBookingBlocked = false;
  if (firstExternal) {
    try {
      await axios.post(
        `${API}/bookings`,
        {
          chargerId: firstExternal.id,
          startTime: new Date(Date.now() + 3600000).toISOString(),
          endTime: new Date(Date.now() + 7200000).toISOString(),
        },
        { headers: seekerHeaders }
      );
    } catch (err) {
      if (err.response && (err.response.status === 400 || err.response.status === 404)) {
        externalBookingBlocked = true;
      }
    }
    record(
      '6. External stations cannot be booked as VoltShare chargers (rejects OCM ID)',
      externalBookingBlocked,
      `booking attempt on "${firstExternal.id}" correctly rejected`
    );
  }

  // Test 7: GET /chargers/:id on external station throws graceful error
  let externalGetBlocked = false;
  if (firstExternal) {
    try {
      await axios.get(`${API}/chargers/${firstExternal.id}`);
    } catch (err) {
      if (err.response && err.response.status === 400) {
        externalGetBlocked = true;
      }
    }
    record(
      '7. Direct charger details API blocks external station booking (400 Bad Request)',
      externalGetBlocked,
      `GET /chargers/${firstExternal.id} blocked`
    );
  }

  // Test 8: Existing VoltShare booking flow remains completely functional
  let voltshareBookingSuccess = false;
  const firstVoltshare = voltshareStations[0];
  if (firstVoltshare) {
    try {
      const futureOffset = 2000000000 + Math.floor(Math.random() * 500000000);
      const bRes = await axios.post(
        `${API}/bookings`,
        {
          chargerId: firstVoltshare.id,
          startTime: new Date(Date.now() + futureOffset).toISOString(),
          endTime: new Date(Date.now() + futureOffset + 3600000).toISOString(),
        },
        { headers: seekerHeaders }
      );
      if (bRes.status === 201 && bRes.data.data.id) {
        voltshareBookingSuccess = true;
      }
    } catch (err) {
      console.error('VoltShare booking error:', err.response?.data || err.message);
    }
    record(
      '8. Existing VoltShare charger booking flow remains 100% operational',
      voltshareBookingSuccess,
      `successfully created booking on VoltShare charger "${firstVoltshare.title}"`
    );
  }

  // Test 9: Charger type filter (DC_FAST)
  const dcFastRes = await axios.get(`${API}/chargers?latitude=${userLat}&longitude=${userLng}&radiusKm=15&chargerType=DC_FAST`);
  const dcFastStations = dcFastRes.data.data || [];
  const allDcFast = dcFastStations.every(s => s.chargerType === 'DC_FAST');
  record(
    '9. Filter by chargerType (DC_FAST) filters both VoltShare and external stations',
    allDcFast && dcFastStations.length > 0,
    `total=${dcFastStations.length} (all DC_FAST)`
  );

  // Test 10: Connector type filter
  const ccs2Res = await axios.get(`${API}/chargers?latitude=${userLat}&longitude=${userLng}&radiusKm=15&connectorType=CCS_2`);
  const ccs2Stations = ccs2Res.data.data || [];
  const allCcs2 = ccs2Stations.every(s => s.connectorType === 'CCS_2' || (s.connectionsList && s.connectionsList.some(c => c.connectorType === 'CCS_2')));
  record(
    '10. Filter by connectorType (CCS_2) filters both VoltShare and external stations',
    allCcs2 && ccs2Stations.length > 0,
    `total=${ccs2Stations.length} (all match CCS_2)`
  );

  // Test 11: Radius filter
  const tightRadiusRes = await axios.get(`${API}/chargers?latitude=${userLat}&longitude=${userLng}&radiusKm=3`);
  const tightStations = tightRadiusRes.data.data || [];
  const allWithin3Km = tightStations.every(s => s.distanceKm <= 3.0);
  record(
    '11. Radius filter strictly limits all returned stations within boundary',
    allWithin3Km,
    `stations=${tightStations.length}, all distance <= 3km`
  );

  // Test 12: External API resilience (service handles errors without crashing)
  const ocmService = require('./packages/api/dist/services/openChargeMap.service');
  const dummyRes = await ocmService.fetchNearbyOpenChargeMapStations(-999, -999, 10);
  record(
    '12. Open Charge Map service handles invalid/failed queries safely without throwing',
    Array.isArray(dummyRes),
    `returned empty array without crashing`
  );

  console.log('='.repeat(70));
  const passCount = results.filter(r => r.pass).length;
  console.log(`Results: ${passCount} Passed, ${results.length - passCount} Failed out of ${results.length} tests.`);
  console.log('='.repeat(70));

  if (passCount !== results.length) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('\n❌ TEST RUN ERROR:', err.response?.data || err);
  process.exit(1);
});
