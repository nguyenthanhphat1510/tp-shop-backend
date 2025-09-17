import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller() // ✅ Không có prefix, sẽ handle /api/
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get() // ✅ Handle GET /api/
  getHello(): object {
    return {
      message: this.appService.getHello(),
      timestamp: new Date().toISOString(),
      status: 'success',
    };
  }

  @Get('health') // ✅ Handle GET /api/health
  getHealth(): object {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      message: 'TpShop API is running!',
      modules: [
        'Database',
        'Cart',
        'Gemini',
        'Products',
        'Auth',
        'User',
        'Category',
        'Subcategory',
        'Order',
        'Payment',
        'Reports',
      ],
    };
  }
}
