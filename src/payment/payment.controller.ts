// import { Controller, Post, Body, Get, Query, Res, BadRequestException, UseGuards, Request } from '@nestjs/common';
// import { Response } from 'express';
// import { MomoService } from '../momo/momo.service';
// import { OrderService } from '../order/order.service';
// import { PaymentStatus, OrderStatus, PaymentMethod } from '../order/entities/order.entity'; // Thêm PaymentMethod
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// interface PendingPaymentData {
//   requestId: string;
//   userId: string;
//   cartItems: any[];
//   shippingInfo: any;
//   amount: number;
//   orderInfo: string;
//   createdAt: Date;
// }

// @Controller('payment')
// export class PaymentController {
//   private pendingPayments: Map<string, PendingPaymentData> = new Map(); // Lưu tạm trong memory

//   constructor(
//     private readonly momoService: MomoService,
//     private readonly orderService: OrderService,
//   ) { }

//   // Tạo payment MoMo từ giỏ hàng (không cần tạo đơn hàng trước)
//   @UseGuards(JwtAuthGuard)
//   @Post('momo/create-from-cart')
//   async createMomoPaymentFromCart(
//     @Body() createPaymentDto: {
//       cartItems: any[];
//       shippingInfo: any;
//       amount: number;
//       orderInfo?: string;
//     },
//     @Request() req: any
//   ) {
//     try {
//       const { cartItems, shippingInfo, amount, orderInfo } = createPaymentDto;
//       const userId = req.user.userId;

//       // Tạo requestId duy nhất
//       const requestId = 'TPSHOP' + Date.now();

//       // Lưu thông tin tạm
//       const pendingData: PendingPaymentData = {
//         requestId,
//         userId,
//         cartItems,
//         shippingInfo,
//         amount,
//         orderInfo: orderInfo || 'Thanh toán đơn hàng TpShop',
//         createdAt: new Date()
//       };

//       this.pendingPayments.set(requestId, pendingData);

//       // Tạo payment với MoMo
//       const response = await this.momoService.createPayment(
//         requestId, // Dùng requestId thay vì orderId
//         amount,
//         pendingData.orderInfo
//       );

//       if (response.resultCode === 0) {
//         return {
//           success: true,
//           message: 'Tạo thanh toán thành công',
//           data: {
//             payUrl: response.payUrl,
//             requestId: requestId,
//             amount: amount
//           }
//         };
//       } else {
//         // Xóa thông tin tạm nếu thất bại
//         this.pendingPayments.delete(requestId);
//         throw new BadRequestException(`Lỗi MoMo: ${response.message}`);
//       }
//     } catch (error) {
//       throw new BadRequestException(error.message || 'Không thể tạo thanh toán');
//     }
//   }

//   // API cũ cho COD (đã có đơn hàng)
//   @Post('momo/create')
//   async createMomoPayment(@Body() createPaymentDto: {
//     orderId: string;
//     amount: number;
//     orderInfo?: string;
//   }) {
//     try {
//       const { orderId, amount, orderInfo } = createPaymentDto;

//       // Kiểm tra order tồn tại
//       const order = await this.orderService.findOne(orderId);
//       if (!order) {
//         throw new BadRequestException('Đơn hàng không tồn tại');
//       }

//       // Tạo payment với MoMo
//       const response = await this.momoService.createPayment(
//         orderId,
//         amount,
//         orderInfo || `Thanh toán đơn hàng ${order.orderNumber}`
//       );

//       if (response.resultCode === 0) {
//         return {
//           success: true,
//           message: 'Tạo thanh toán thành công',
//           data: {
//             payUrl: response.payUrl,
//             orderId: orderId,
//             amount: amount
//           }
//         };
//       } else {
//         throw new BadRequestException(`Lỗi MoMo: ${response.message}`);
//       }
//     } catch (error) {
//       throw new BadRequestException(error.message || 'Không thể tạo thanh toán');
//     }
//   }

//   // Callback từ MoMo sau khi user thanh toán
//   @Get('momo/callback')
//   async momoCallback(@Query() query: any, @Res() res: Response) {
//     try {
//       console.log('MoMo Callback:', query);
//       console.log('=== MoMo Callback Debug ===');
//       console.log('Query params:', query);
//       console.log('Pending payments keys:', Array.from(this.pendingPayments.keys()));
//       console.log('CLIENT_URL:', process.env.CLIENT_URL);

//       // TẠM THỜI BỎ QUA SIGNATURE VALIDATION ĐỂ TEST
//       // const isValidSignature = this.momoService.verifySignature(query);
//       const isValidSignature = true; // Tạm thời set true

//       if (!isValidSignature) {
//         return res.redirect(`${process.env.CLIENT_URL}/payment/failed?reason=invalid_signature`);
//       }

//       if (query.resultCode === '0') {
//         // Thanh toán thành công
//         const orderId = query.orderId;
//         console.log('Processing successful payment for orderId:', orderId);

//         // Kiểm tra xem có phải thanh toán từ giỏ hàng không
//         const pendingData = this.pendingPayments.get(orderId);
//         console.log('Pending data found:', !!pendingData);

//         if (pendingData) {
//           // Tạo đơn hàng từ thông tin tạm
//           const order = await this.orderService.create(pendingData.userId, {
//             items: pendingData.cartItems,
//             shippingInfo: pendingData.shippingInfo,
//             paymentMethod: PaymentMethod.MOMO,
//             createFromCart: false,
//             note: 'Đã thanh toán qua MoMo'
//           });

//           console.log('Order created:', order.id);

//           // Cập nhật trạng thái đã thanh toán
//           await this.orderService.update(order.id, {
//             paymentStatus: PaymentStatus.PAID,
//             status: OrderStatus.CONFIRMED
//           });

//           // Xóa thông tin tạm
//           this.pendingPayments.delete(orderId);

//           // Redirect đến order-success
//           return res.redirect(`${process.env.CLIENT_URL}/order-success?orderId=${order.id}`);
//         } else {
//           // Đơn hàng đã tồn tại, chỉ cập nhật trạng thái
//           await this.orderService.update(orderId, {
//             paymentStatus: PaymentStatus.PAID,
//             status: OrderStatus.CONFIRMED
//           });

//           return res.redirect(`${process.env.CLIENT_URL}/order-success?orderId=${orderId}`);
//         }
//       } else {
//         // Thanh toán thất bại
//         this.pendingPayments.delete(query.orderId);
//         return res.redirect(`${process.env.CLIENT_URL}/payment/failed?orderId=${query.orderId}&reason=${query.message}`);
//       }
//     } catch (error) {
//       console.error('MoMo Callback Error:', error);
//       this.pendingPayments.delete(query.orderId);
//       return res.redirect(`${process.env.CLIENT_URL}/payment/failed?reason=system_error`);
//     }
//   }

//   // IPN từ MoMo (webhook)
//   @Post('momo/ipn')
//   async momoIPN(@Body() body: any) {
//     try {
//       console.log('MoMo IPN:', body);

//       const isValidSignature = this.momoService.verifySignature(body);

//       if (!isValidSignature) {
//         return { resultCode: 1, message: 'Invalid signature' };
//       }

//       if (body.resultCode === 0) {
//         const orderId = body.orderId;
//         const pendingData = this.pendingPayments.get(orderId);

//         if (pendingData) {
//           // Tạo đơn hàng từ thông tin tạm
//           const order = await this.orderService.create(pendingData.userId, {
//             items: pendingData.cartItems,
//             shippingInfo: pendingData.shippingInfo,
//             paymentMethod: PaymentMethod.MOMO, // Sửa từ 'momo' thành PaymentMethod.MOMO
//             createFromCart: false,
//             note: 'Đã thanh toán qua MoMo'
//           });

//           // Cập nhật trạng thái
//           await this.orderService.update(order.id, {
//             paymentStatus: PaymentStatus.PAID,
//             status: OrderStatus.CONFIRMED
//           });

//           // Xóa thông tin tạm
//           this.pendingPayments.delete(orderId);
//         } else {
//           // Cập nhật đơn hàng đã tồn tại
//           await this.orderService.update(orderId, {
//             paymentStatus: PaymentStatus.PAID,
//             status: OrderStatus.CONFIRMED
//           });
//         }
//       }

//       return { resultCode: 0, message: 'Success' };
//     } catch (error) {
//       console.error('MoMo IPN Error:', error);
//       return { resultCode: 1, message: 'Error' };
//     }
//   }
// }