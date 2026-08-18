// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const requiredEnvKeys = ['NODE_ENV', 'PORT', 'APP_URL', 'MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const missingEnvKeys = requiredEnvKeys.filter((key) => !process.env[key]);

  if (missingEnvKeys.length > 0) {
    console.warn(`[startup] Missing required environment variables: ${missingEnvKeys.join(', ')}`);
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Enable graceful shutdown to release ports cleanly on process signals
  app.enableShutdownHooks();

  // 1. CORS CONFIGURATION
  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://event-stack-frontend-173m.vercel.app',
  ];

  const envOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : [];

  // Merge environment origins with local development defaults
  const allowedOrigins = Array.from(new Set([...devOrigins, ...envOrigins]));

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 204,
  });

  // 2. HELMET SECURITY HEADERS
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Prevents Helmet from overriding CORS headers
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // 3. GLOBAL ROUTING + VERSIONING
  // Keep the public health and status routes outside the API prefix so
  // deployment/proxy readiness checks and unversioned client paths succeed.
  app.setGlobalPrefix('api', {
    exclude: ['/', 'health', 'health-check', 'sitemap.xml', 'robots.txt'],
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  // 4. GLOBAL VALIDATION PIPE
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 5. SWAGGER OPENAPI DOCUMENTATION
  const swaggerConfig = new DocumentBuilder()
    .setTitle('EventStack API')
    .setDescription('Multi-tenant event website creation and management platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // 6. SERVER INITIALIZATION
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`🚀 EventStack API running on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('❌ Application failed to start:', err);
  process.exit(1);
});