import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  app.use(
    helmet({
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

  app.enableCors({
    origin: process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Exclude root SEO endpoints from global /api prefix
  app.setGlobalPrefix('api', {
    exclude: ['sitemap.xml', 'robots.txt'],
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('EventStack API')
    .setDescription('Multi-tenant event website creation and management platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  
  // Explicitly listen on 0.0.0.0 to allow IPv4 connections
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 EventStack API running on http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('❌ Application failed to start:', err);
  process.exit(1);
});