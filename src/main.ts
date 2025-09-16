import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  console.log('JWT_SECRET:', configService.get('JWT_SECRET'));
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });
  
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on port ${port}`);
}

// Local development
if (process.env.NODE_ENV !== 'production') {
  bootstrap();
}

// ✅ FIX: Export handler for Vercel
let cachedApp: any = null;

async function createNestApp() {
  if (!cachedApp) {
    cachedApp = await NestFactory.create(AppModule, {
      logger: false,
    });
    cachedApp.setGlobalPrefix('api');
    cachedApp.enableCors({
      origin: '*',
      credentials: true,
    });
    await cachedApp.init();
  }
  return cachedApp;
}

// ✅ Named export for Vercel
export const handler = async (req: any, res: any) => {
  try {
    const app = await createNestApp();
    const server = app.getHttpAdapter().getInstance();
    return server(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
};

// ✅ Default export for Vercel
export default handler;
