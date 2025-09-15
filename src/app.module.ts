// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
// import { UsersModule } from './users/users.module';
// import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CategoryModule } from './category/category.module';
import { SubcategoryModule } from './subcategory/subcategory.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module'; 
import { GeminiModule } from './gemini/gemini.module';
import { PaymentModule } from './payment/payment.module'; // Import the Gemini module
import { ReportsModule } from './reports/reports.module'; // Import the Reports module




@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    CartModule,
    GeminiModule,
    // UsersModule,
    // AuthModule,
    ProductsModule,
    AuthModule,
    UserModule,
    CategoryModule,
    SubcategoryModule,
     OrderModule,
     PaymentModule,
     ReportsModule,
  ],
})
export class AppModule {}
