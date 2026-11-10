/**
 * Verification Suite for VoltShare Navbar Charger List Visibility & Role-based Behavior
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { twMerge } = require('tailwind-merge');

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
  console.log('  VoltShare Navbar Charger List Visibility & Role Verification');
  console.log('='.repeat(70));

  // 1. Inspect Navbar.tsx source code directly
  const navbarPath = path.join(__dirname, 'apps/web/components/layout/Navbar.tsx');
  const navbarSource = fs.readFileSync(navbarPath, 'utf8');

  // Verify Charger List exists and links to /dashboard
  const hasChargerListLink = navbarSource.includes('href="/dashboard"') && navbarSource.includes('Charger List');
  record('1. Charger List exists and links to /dashboard', hasChargerListLink);

  // Verify Zap icon is used for Charger List
  const hasZapIcon = navbarSource.includes('Zap') && navbarSource.includes('Charger List');
  record('2. Charger List uses Zap (electric bolt) icon', hasZapIcon);

  // Verify My Vehicles exists and links to /profile/vehicles
  const hasMyVehiclesLink = navbarSource.includes('href="/profile/vehicles"') && navbarSource.includes('My Vehicles');
  record('3. My Vehicles exists and links to /profile/vehicles', hasMyVehiclesLink);

  // Verify role condition for Charger List (HOST only)
  const isHostGuarded = navbarSource.includes("userRole === 'HOST'") && navbarSource.includes('Charger List');
  record('4. Charger List is strictly host-guarded (userRole === "HOST")', isHostGuarded);

  // 2. CSS / Styling Verification: Ensure NO bg-white on Charger List button
  const buttonStyleRegex = /<Link href="\/dashboard">\s*<Button[\s\S]*?className="([^"]+)"/;
  const match = navbarSource.match(buttonStyleRegex);
  const chargerButtonClasses = match ? match[1] : '';

  // Button base styles for 'ghost' variant: 'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-500'
  const mergedClasses = twMerge(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-500 px-3 py-1.5 text-sm',
    chargerButtonClasses
  );

  const hasNoBgWhite = !mergedClasses.includes('bg-white');
  record('5. Merged classes do NOT contain bg-white', hasNoBgWhite, `Classes: ${mergedClasses}`);

  const hasDarkBg = mergedClasses.includes('bg-gray-800');
  record('6. Merged classes contain dark background (bg-gray-800)', hasDarkBg);

  const hasVisibleText = mergedClasses.includes('text-gray-200');
  record('7. Merged classes contain visible light text (text-gray-200)', hasVisibleText);

  // 3. API Role Check for SEEKER & HOST
  const rSeeker = await request(`${BASE}/auth/register`, 'POST', {
    email: `seeker_nav_${TS}@test.com`,
    password: 'Password123!',
    name: 'Seeker Nav Test',
    role: 'SEEKER',
  });
  const seekerToken = rSeeker.body?.data?.token;
  const seekerPayload = JSON.parse(Buffer.from(seekerToken.split('.')[1], 'base64').toString());
  record('8. SEEKER token payload correctly contains role="SEEKER"', seekerPayload.role === 'SEEKER');

  const rHost = await request(`${BASE}/auth/register`, 'POST', {
    email: `host_nav_${TS}@test.com`,
    password: 'Password123!',
    name: 'Host Nav Test',
    role: 'HOST',
  });
  const hostToken = rHost.body?.data?.token;
  const hostPayload = JSON.parse(Buffer.from(hostToken.split('.')[1], 'base64').toString());
  record('9. HOST token payload correctly contains role="HOST"', hostPayload.role === 'HOST');

  // 4. Verify Next.js routes
  const rDashboard = await request('http://localhost:3000/dashboard');
  record('10. Host charger list/management route (/dashboard) returns 200 OK', rDashboard.status === 200);

  const rVehicles = await request('http://localhost:3000/profile/vehicles');
  record('11. Driver vehicle route (/profile/vehicles) returns 200 OK', rVehicles.status === 200);

  const rHome = await request('http://localhost:3000');
  record('12. Home route (/) returns 200 OK', rHome.status === 200);

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
