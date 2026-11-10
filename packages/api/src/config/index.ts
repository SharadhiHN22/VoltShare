// ── Environment Configuration ────────────────────────

export const config = {
  /** Server port */
  port: parseInt(process.env.PORT || '4000', 10),

  /** Node environment */
  nodeEnv: process.env.NODE_ENV || 'development',

  /** MySQL 8.0 connection string */
  databaseUrl:
    process.env.DATABASE_URL ||
    `mysql://root:${encodeURIComponent(process.env.MYSQL_PASSWORD || '')}@localhost:3306/voltshare`,

  /** JWT signing secret */
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',

  /** JWT token expiration */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  /** CORS allowed origin */
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  /** Platform fee percentage taken from each transaction */
  platformFeePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || '10'),

  /** Razorpay API key ID */
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',

  /** Razorpay API key secret */
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',

  /** Redis connection URL */
  redisUrl: process.env.REDIS_URL || '',

  /** Google Maps API key */
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',

  /** Open Charge Map API key */
  openChargeMapApiKey: process.env.OPEN_CHARGE_MAP_API_KEY || '',
} as const;
