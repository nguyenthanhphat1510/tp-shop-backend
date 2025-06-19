// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
// import { UsersModule } from './users/users.module';
// import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    // UsersModule,
    // AuthModule,
    ProductsModule,
  ],
})
export class AppModule {}
