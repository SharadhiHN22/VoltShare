const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

async function verify() {
  console.log('='.repeat(70));
  console.log('  VOLTSHARE HOMEPAGE DYNAMIC STATS VERIFICATION');
  console.log('='.repeat(70));

  // 1. Fetch from stats API
  const apiRes = await get('http://localhost:4000/api/stats');
  console.log('1. API Status:', apiRes.status);
  console.log('   Stats Response:', JSON.stringify(apiRes.body, null, 2));

  if (!apiRes.body || !apiRes.body.success || !apiRes.body.data) {
    throw new Error('API did not return successful stats data');
  }

  const { registeredDrivers, activeChargers, completedSessions, reviewsCount } = apiRes.body.data;
  console.log('\n2. Live Database Values:');
  console.log('   - Registered EV Drivers (SEEKER):', registeredDrivers);
  console.log('   - Active Charging Ports (ACTIVE chargers):', activeChargers);
  console.log('   - Completed Charging Sessions (COMPLETED bookings):', completedSessions);
  console.log('   - Customer Reviews (Review count):', reviewsCount);

  // 3. Fetch from Web Server homepage
  const webRes = await get('http://localhost:3000/');
  console.log('\n3. Web Server Status:', webRes.status);
  
  const hasDriversLabel = webRes.body.includes('Registered EV Drivers');
  const hasPortsLabel = webRes.body.includes('Active Charging Ports');
  const hasCompletedLabel = webRes.body.includes('Completed Charging Sessions');
  const hasReviewsLabel = webRes.body.includes('Customer Reviews');

  console.log('   Labels present in rendered HTML:');
  console.log('   - "Registered EV Drivers":', hasDriversLabel);
  console.log('   - "Active Charging Ports":', hasPortsLabel);
  console.log('   - "Completed Charging Sessions":', hasCompletedLabel);
  console.log('   - "Customer Reviews":', hasReviewsLabel);

  const noFakeUptime = !webRes.body.includes('99.8%');
  const noFakePayments = !webRes.body.includes('100%');
  const noFakeDrivers = !webRes.body.includes('5,000+');
  const noFakePorts = !webRes.body.includes('1,200+');

  console.log('\n4. Fake Hardcoded Data Elimination:');
  console.log('   - "5,000+" eliminated:', noFakeDrivers);
  console.log('   - "1,200+" eliminated:', noFakePorts);
  console.log('   - "99.8%" eliminated:', noFakeUptime);
  console.log('   - "100%" eliminated:', noFakePayments);

  const allPassed =
    apiRes.status === 200 &&
    hasDriversLabel &&
    hasPortsLabel &&
    hasCompletedLabel &&
    hasReviewsLabel &&
    noFakeDrivers &&
    noFakePorts &&
    noFakeUptime &&
    noFakePayments;

  console.log('\n' + '='.repeat(70));
  console.log('  VERIFICATION RESULT:', allPassed ? 'ALL CHECKS PASSED ✅' : 'CHECKS FAILED ❌');
  console.log('='.repeat(70));

  if (!allPassed) {
    process.exit(1);
  }
}

verify().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
