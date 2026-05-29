import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed = [
        frontendUrl,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ];
      const ok =
        allowed.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        /\.cursor\.(app|sh|com)|\.cursorapi\.com|\.vscode-cursor\.com/.test(
          origin,
        );
      callback(null, ok);
    },
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Vendor Management System API')
    .setDescription('Comprehensive VMS API for managing vendors, purchase orders, contracts, and more')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('vendors', 'Vendor management')
    .addTag('purchase-orders', 'Purchase order management')
    .addTag('contracts', 'Contract management')
    .addTag('evaluations', 'Vendor performance evaluations')
    .addTag('reports', 'Reporting and analytics')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);

  console.log(`🚀 VMS Backend API is running on: http://${host}:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api`);
}

bootstrap();

