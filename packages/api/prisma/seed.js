const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://root:' + encodeURIComponent(process.env.MYSQL_PASSWORD) + '@localhost:3306/voltshare',
    },
  },
});

async function seed() {
  console.log('🌱 Seeding initial VoltShare sample data...');

  try {
    const passwordHash = await bcrypt.hash('VoltShare@2026', 10);

    // 1. Create a Host User
    const host = await prisma.user.upsert({
      where: { email: 'host.indiranagar@voltshare.com' },
      update: {},
      create: {
        email: 'host.indiranagar@voltshare.com',
        name: 'Arun Kumar',
        phone: '+919845012345',
        role: 'HOST',
        passwordHash,
        isVerified: true,
      },
    });

    // 2. Create a Driver / Seeker User
    const seeker = await prisma.user.upsert({
      where: { email: 'driver.karthik@voltshare.com' },
      update: {},
      create: {
        email: 'driver.karthik@voltshare.com',
        name: 'Karthik Raja',
        phone: '+919980198765',
        role: 'SEEKER',
        passwordHash,
        isVerified: true,
      },
    });

    // 3. Add Sample Chargers
    const sampleChargers = [
      {
        title: 'Indiranagar 100ft Fast Hub',
        description: 'Commercial 60kW DC Fast Charger with secure covered parking and lounge.',
        latitude: 12.9716,
        longitude: 77.5946,
        address: '100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru',
        chargerType: 'DC_FAST',
        connectorType: 'CCS_2',
        kwRating: 60.0,
        pricePerKwh: 18.5,
        status: 'ACTIVE',
        availabilityHours: [
          { day: 0, startTime: '06:00', endTime: '23:00' },
          { day: 1, startTime: '06:00', endTime: '23:00' },
          { day: 2, startTime: '06:00', endTime: '23:00' },
          { day: 3, startTime: '06:00', endTime: '23:00' },
          { day: 4, startTime: '06:00', endTime: '23:00' },
          { day: 5, startTime: '06:00', endTime: '23:00' },
          { day: 6, startTime: '06:00', endTime: '23:00' },
        ],
        photoUrls: ['https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800'],
        avgRating: 4.85,
        totalReviews: 24,
        isPublicStation: false,
      },
      {
        title: 'Koramangala 4th Block Home Port',
        description: 'Level 2 7.4kW AC charger located in dedicated private villa driveway.',
        latitude: 12.9345,
        longitude: 77.6265,
        address: '80 Feet Rd, 4th Block, Koramangala, Bengaluru',
        chargerType: 'LEVEL_2',
        connectorType: 'TYPE_2',
        kwRating: 7.4,
        pricePerHour: 90.0,
        status: 'ACTIVE',
        availabilityHours: [
          { day: 1, startTime: '08:00', endTime: '20:00' },
          { day: 2, startTime: '08:00', endTime: '20:00' },
          { day: 3, startTime: '08:00', endTime: '20:00' },
          { day: 4, startTime: '08:00', endTime: '20:00' },
          { day: 5, startTime: '08:00', endTime: '20:00' },
        ],
        photoUrls: ['https://images.unsplash.com/photo-1558441719-8b449c6ff673?w=800'],
        avgRating: 4.9,
        totalReviews: 12,
        isPublicStation: false,
      },
      {
        title: 'Whitefield Tech Park Hub',
        description: 'High-speed 120kW Dual-Gun DC Fast Charger with 24/7 security.',
        latitude: 12.9868,
        longitude: 77.7374,
        address: 'ITPL Main Rd, Whitefield, Bengaluru',
        chargerType: 'DC_FAST',
        connectorType: 'CCS_2',
        kwRating: 120.0,
        pricePerKwh: 21.0,
        status: 'ACTIVE',
        availabilityHours: [
          { day: 0, startTime: '00:00', endTime: '23:59' },
          { day: 1, startTime: '00:00', endTime: '23:59' },
          { day: 2, startTime: '00:00', endTime: '23:59' },
          { day: 3, startTime: '00:00', endTime: '23:59' },
          { day: 4, startTime: '00:00', endTime: '23:59' },
          { day: 5, startTime: '00:00', endTime: '23:59' },
          { day: 6, startTime: '00:00', endTime: '23:59' },
        ],
        photoUrls: ['https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800'],
        avgRating: 4.75,
        totalReviews: 45,
        isPublicStation: true,
      },
    ];

    for (const data of sampleChargers) {
      const existing = await prisma.charger.findFirst({ where: { title: data.title } });
      if (!existing) {
        await prisma.charger.create({
          data: {
            ...data,
            hostId: host.id,
          },
        });
      }
    }

    console.log('✅ Sample data seeded successfully:');
    console.log(` - Host: ${host.email}`);
    console.log(` - Driver: ${seeker.email}`);
    console.log(` - Chargers added: ${sampleChargers.length}`);
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
