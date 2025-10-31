// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  console.log('🚀 === STARTING APPLICATION ===');
  
  const app = await NestFactory.create(AppModule);
  console.log('✅ NestJS application created');

  // ✅ THÊM GLOBAL PREFIX /api
  app.setGlobalPrefix('api');
  console.log('✅ Global prefix set to /api');

  // ✅ ENABLE CORS cho development và production
  app.enableCors({
    origin: [
      'http://localhost:3000',    // Backend URL (nếu cần)
      'http://localhost:3001',    // ✅ Frontend development URL
      'http://localhost:5173',    // Vite default port
      'http://localhost:3002',    // Backup port
      'https://tp-shop-frontend.vercel.app', // Production URL
      'https://*.vercel.app',     // All Vercel deployments
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'Origin', 
      'X-Requested-With',
      'Accept'
    ],
    credentials: true, // Cho phép cookies/credentials
  });
  console.log('✅ CORS enabled');

  // ✅ Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));
  console.log('✅ Global validation pipe configured');

  // ✅ CẤU HÌNH SWAGGER CHỈ CHO AUTH
  const config = new DocumentBuilder()
    .setTitle('TpShop Auth API')
    .setDescription('Authentication API documentation for TpShop platform')
    .setVersion('1.0')
    .addTag('auth', 'Authentication operations')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customfavIcon: '/favicon.ico',
    customSiteTitle: 'TpShop Auth API Docs',
    customCss: `
      .topbar-wrapper img { content: url('/logo.png'); width: 120px; height: auto; }
      .swagger-ui .topbar { padding: 10px 0; background-color: #1f2937; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
    `,
  });
  console.log('✅ Swagger UI configured for Auth APIs only');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log('🎉 === APPLICATION STARTED SUCCESSFULLY ===');
  console.log(`🚀 Backend API running on http://localhost:${port}`);
  console.log(`📚 Auth API Docs available at http://localhost:${port}/api/docs`);
  console.log(`🌐 CORS enabled for localhost:3001`);
  console.log('============================================');
}

bootstrap();
