// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { ProductsModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CategoryModule } from './category/category.module';
import { SubcategoryModule } from './subcategory/subcategory.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';
import { GeminiModule } from './gemini/gemini.module';
import { PaymentModule } from './payment/payment.module';
import { ReportsModule } from './reports/reports.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
    CartModule,
    GeminiModule,
    ProductsModule,
    AuthModule,
    UserModule,
    CategoryModule,
    SubcategoryModule,
    OrderModule,
    PaymentModule,
    ReportsModule,
  ],
  controllers: [AppController],   // ✅ thêm
  providers: [AppService],        // ✅ thêm
})
export class AppModule { }
