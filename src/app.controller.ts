import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello(): string {
    return 'Hello World! TpShop API is running!';
  }

  // ✅ Thêm route /api cho Vercel
  @Get('api')
  getApi(): string {
    return 'Hello World! TpShop API is running on Vercel!';
  }

  @Get('health')
  health(): object {
    return { 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL ? 'vercel' : 'local'
    };
  }

  // ✅ Thêm route /api/health cho Vercel
  @Get('api/health')
  apiHealth(): object {
    return { 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      environment: 'vercel',
      route: 'api/health'
    };
  }
}
