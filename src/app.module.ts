// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';  // ✅ Thêm dòng này
import { DatabaseModule } from './database/database.module';
// import { UsersModule } from './users/users.module';
// import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CategoryModule } from './category/category.module';
import { SubcategoryModule } from './subcategory/subcategory.module';
// import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module'; 
import { GeminiModule } from './gemini/gemini.module';
import { PaymentModule } from './payment/payment.module'; // Import the Gemini module
import { ReportsModule } from './reports/reports.module'; // Import the Reports module
import { MulterModule } from '@nestjs/platform-express';
import { VNPayModule } from './vnpay/vnpay.module';
import { ReviewsModule } from './reviews/reviews.module';



@Module({
  imports: [
    // ✅ Thêm global multer nếu chưa có
    MulterModule.register({
      dest: './uploads',
      limits: { fileSize: 10 * 1024 * 1024 }
    }),
    
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    // CartModule,
    GeminiModule,
    // UsersModule,
    // AuthModule,
      VNPayModule, // Thêm VNPay module
    ProductsModule,
    AuthModule,
    UserModule,
    CategoryModule,
    SubcategoryModule,
     OrderModule,
     PaymentModule,
     ReportsModule,
     ReviewsModule,
  ],
  controllers: [AppController],  // ✅ Thêm dòng này
})
export class AppModule {}
