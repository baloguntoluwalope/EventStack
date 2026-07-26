/**
 * Single typed source of configuration access. Modules inject
 * ConfigService and read through here — never process.env directly.
 */
export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '', 10) || 3000,
  appName: 'EventStack',
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  mongoUri: process.env.MONGO_URI,

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  },

  cors: {
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  },

rateLimit: {
    ttlSeconds: parseInt(process.env.RATE_LIMIT_TTL || '', 10) || 60,
    limit: parseInt(process.env.RATE_LIMIT_MAX || '', 10) || 100,
  },

  // Provider config is read here even before concrete providers exist,
  // so the config contract is stable across phases.
  email: {
    provider: process.env.EMAIL_PROVIDER || 'brevo',
    brevoApiKey: process.env.BREVO_API_KEY,
    senderEmail: process.env.EMAIL_SENDER_ADDRESS || 'no-reply@eventstack.app',
    senderName: process.env.EMAIL_SENDER_NAME || 'EventStack',
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'cloudinary',
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
  },

  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'none',
  },
});