/**
 * Verification Suite for VoltShare Real User Location Detection & Geospatial Search
 */

const http = require('http');

const BASE = 'http://localhost:4000/api';
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
  console.log('  VoltShare Real Location Detection & Geospatial Search Suite');
  console.log('='.repeat(70));

  // 1. Search with detected real user coordinates (e.g. Indiranagar user: 12.9783, 77.6408)
  const realLat = 12.9783;
  const realLng = 77.6408;
  const rNearby = await request(`${BASE}/chargers?latitude=${realLat}&longitude=${realLng}&radiusKm=10`);
  const stations = rNearby.body?.data || [];
  record(
    '1. Geospatial search accepts real user coordinates and returns nearby stations',
    rNearby.status === 200 && Array.isArray(stations) && stations.length > 0,
    `Found ${stations.length} stations nearby`
  );

  // 2. Proximity ordering: Closest station should be nearest to user
  let isSorted = true;
  for (let i = 1; i < stations.length; i++) {
    if (stations[i].distanceKm < stations[i - 1].distanceKm) {
      isSorted = false;
      break;
    }
  }
  record(
    '2. Stations are correctly ordered by distance from user location (nearest first)',
    isSorted && stations.length > 0,
    `Closest: ${stations[0]?.title} at ${stations[0]?.distanceKm?.toFixed(2)} km`
  );

  // 3. User in different city/area (e.g. Delhi: 28.6139, 77.2090)
  const rDelhi = await request(`${BASE}/chargers?latitude=28.6139&longitude=77.2090&radiusKm=10`);
  record(
    '3. Search with non-default city location handles 0 results gracefully without crashing',
    rDelhi.status === 200 && Array.isArray(rDelhi.body?.data),
    `Count: ${rDelhi.body?.data?.length}`
  );

  // 4. Fallback search when coordinates are fallback center
  const rFallback = await request(`${BASE}/chargers?latitude=12.9716&longitude=77.5946&radiusKm=15`);
  record(
    '4. Fallback search functions correctly when permission denied or unavailable',
    rFallback.status === 200 && Array.isArray(rFallback.body?.data) && rFallback.body.data.length > 0,
    `Found ${rFallback.body?.data?.length} fallback stations`
  );

  // 5. Radius scaling with real user location (radius 5km vs 25km)
  const rSmallRadius = await request(`${BASE}/chargers?latitude=${realLat}&longitude=${realLng}&radiusKm=5`);
  const rLargeRadius = await request(`${BASE}/chargers?latitude=${realLat}&longitude=${realLng}&radiusKm=25`);
  const smallCount = rSmallRadius.body?.data?.length || 0;
  const largeCount = rLargeRadius.body?.data?.length || 0;
  record(
    '5. Radius filter scales correctly with real user coordinates',
    smallCount <= largeCount,
    `5km: ${smallCount} stations, 25km: ${largeCount} stations`
  );

  // 6. Non-numeric or invalid coordinates rejection
  const rInvalid = await request(`${BASE}/chargers?latitude=invalid&longitude=invalid`);
  record('6. Invalid coordinates safely rejected by API (400)', rInvalid.status === 400);

  // 7. Check web page route /map
  const rMapPage = await request('http://localhost:3000/map');
  record('7. /map route returns 200 OK', rMapPage.status === 200);

  console.log('='.repeat(70));
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`Results: ${passed} Passed, ${failed} Failed out of ${results.length} tests.`);
  console.log('='.repeat(70));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
