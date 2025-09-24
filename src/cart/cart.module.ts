// import { Module, forwardRef } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { CartItem } from './entities/cart.entity';
// import { CartService } from './cart.service';
// import { CartController } from './cart.controller';
// import { ProductsModule } from '../products/products.module'; // ✅ Sửa tên module

// @Module({
//     imports: [
//         TypeOrmModule.forFeature([CartItem]),
//         forwardRef(() => ProductsModule) // ✅ Import ProductsModule
//     ],
//     controllers: [CartController],
//     providers: [CartService],
//     exports: [CartService],
// })
// export class CartModule { }