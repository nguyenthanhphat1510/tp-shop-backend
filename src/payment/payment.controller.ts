import { Controller, Post, Body, Get, Query, Res, BadRequestException, UseGuards, Request, Param } from '@nestjs/common';
import { Response } from 'express';
import { MomoService } from '../momo/momo.service';
import { VNPayService } from '../vnpay/vnpay.service';
import { OrderService } from '../order/order.service';
import { PaymentStatus, OrderStatus, PaymentMethod } from '../order/entities/order.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payment') // Route gốc: /payment
export class PaymentController {
    constructor(
        private readonly momoService: MomoService,   // Service xử lý MoMo API
        private readonly vnpayService: VNPayService, // Thêm VNPay service
        private readonly orderService: OrderService, // Service xử lý đơn hàng
    ) { }

    /**
     * 💳 TẠO THANH TOÁN MOMO CHO ĐƠN HÀNG ĐÃ TỒN TẠI
     * 
     * FLOW:
     * 1. Frontend tạo order trước (COD)
     * 2. User chọn "Thanh toán MoMo" 
     * 3. Frontend gọi API này với orderId
     * 4. Backend tạo MoMo payment link
     * 5. User vào link đó để thanh toán
     * 
     * ENDPOINT: POST /payment/momo/create
     * INPUT: { orderId, amount, orderInfo? }
     * OUTPUT: { success, data: { payUrl, orderId, ... } }
     */
   @Post('momo/create')
async createMomoPayment(@Body() createPaymentDto: {
    orderId: string;
    amount: number;
    orderInfo?: string;
}) {
    try {
        // ✅ DESTRUCTURE ngay từ đầu để đảm bảo lấy đúng giá trị
        const { orderId, amount, orderInfo } = createPaymentDto;

        // ✅ LOG ĐỂ DEBUG
        console.log('🏪 Creating MoMo payment');
        console.log('  - orderId:', orderId);
        console.log('  - orderId type:', typeof orderId);
        console.log('  - amount:', amount);
        console.log('  - orderInfo:', orderInfo);

        // ✅ VALIDATE orderId là string
        if (!orderId || typeof orderId !== 'string') {
            throw new BadRequestException('Order ID phải là string');
        }

        // ===== BƯỚC 1: KIỂM TRA ĐƠN HÀNG =====
        console.log('🔍 Calling orderService.findOne with orderId:', orderId);
        
        // ✅ CHỈ TRUYỀN orderId (string), KHÔNG TRUYỀN cả object
        const order = await this.orderService.findOne(orderId);
        
        if (!order) {
            throw new BadRequestException('Đơn hàng không tồn tại');
        }

        console.log('✅ Order found:', order._id.toString());

        // ===== BƯỚC 2: KIỂM TRA PAYMENT STATUS =====
        if (order.paymentStatus === PaymentStatus.PAID) {
            throw new BadRequestException('Đơn hàng đã được thanh toán');
        }

        // ===== BƯỚC 3: KIỂM TRA ORDER STATUS =====
        if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
            throw new BadRequestException('Đơn hàng không thể thanh toán ở trạng thái hiện tại');
        }

        // ===== BƯỚC 4: TẠO MOMO PAYMENT =====
        const momoResponse = await this.momoService.createPayment(
            orderId,
            amount,
            orderInfo || `Thanh toán đơn hàng ${order.orderNumber}`
        );

        console.log('📤 MoMo response:', momoResponse);

        // ===== BƯỚC 5: TRẢ VỀ KẾT QUẢ =====
        if (momoResponse.success) {
            return {
                success: true,
                message: 'Tạo thanh toán thành công',
                data: {
                    payUrl: momoResponse.payUrl,
                    orderId: orderId,
                    orderNumber: order.orderNumber,
                    amount: amount
                }
            };
        } else {
            throw new BadRequestException(`Lỗi MoMo: ${momoResponse.message}`);
        }

    } catch (error) {
        console.error('❌ Create MoMo payment error:', error);
        throw new BadRequestException(error.message || 'Không thể tạo thanh toán');
    }
}
    /**
     * 🔄 CALLBACK TỪ MOMO (USER REDIRECT)
     * 
     * FLOW:
     * 1. User thanh toán xong trên MoMo app/web
     * 2. MoMo tự động chuyển hướng user về URL này
     * 3. Backend kiểm tra kết quả và chuyển user đến trang phù hợp
     * 4. KHÔNG cập nhật database ở đây (đã làm ở IPN)
     * 
     * ENDPOINT: GET /payment/momo/callback
     * INPUT: Query params từ MoMo (orderId, resultCode, signature, ...)
     * OUTPUT: Redirect user đến frontend
     */
    @Get('momo/callback')
    async momoCallback(@Query() query: any, @Res() res: Response) {
        try {
            console.log('=== MoMo Callback Debug ===');
            console.log('📞 MoMo Callback received:', query);
            console.log('⏰ Callback time:', new Date().toISOString());

            // ===== BƯỚC 1: LẤY THÔNG TIN CƠ BẢN =====
            const orderId = query.orderId;
            const resultCode = query.resultCode; // '0' = thành công, khác = thất bại
            const message = query.message || '';
            const transId = query.transId || '';

            // ===== BƯỚC 2: KIỂM TRA DỮ LIỆU CƠ BẢN =====
            if (!orderId) {
                console.log('❌ Missing orderId in callback');
                return res.redirect(`${process.env.CLIENT_URL}/payment/failed?reason=missing_order_id`);
            }

            if (!resultCode) {
                console.log('❌ Missing resultCode in callback');
                return res.redirect(`${process.env.CLIENT_URL}/payment/failed?reason=missing_result_code`);
            }

            console.log(`🔍 Processing callback: orderId=${orderId}, resultCode=${resultCode}`);

            // ===== BƯỚC 3: XÁC THỰC SIGNATURE (TÙY CHỌN) =====
            // Tạm thời bỏ qua để test, sau này bật lại để bảo mật
            try {
                // const isValidSignature = this.momoService.verifyCallback(query);
                const isValidSignature = true; // TODO: Bật lại sau khi test xong
                
                if (!isValidSignature) {
                    console.log('❌ Invalid callback signature');
                    return res.redirect(`${process.env.CLIENT_URL}/payment/failed?reason=invalid_signature`);
                }
            } catch (signatureError) {
                console.log('⚠️ Signature verification error:', signatureError.message);
                // Vẫn tiếp tục để không block user, nhưng log lại để debug
            }

            // ===== BƯỚC 4: XỬ LÝ THEO KẾT QUẢ =====
            if (resultCode === '0') {
                // ✅ THANH TOÁN THÀNH CÔNG
                console.log('✅ Callback: Payment successful for order:', orderId);

                try {
                    // Kiểm tra order có tồn tại không (double-check)
                    const order = await this.orderService.findOne(orderId);
                    if (!order) {
                        console.log('⚠️ Callback: Order not found, but payment seems successful:', orderId);
                        return res.redirect(`${process.env.CLIENT_URL}/payment/failed?reason=order_not_found&orderId=${orderId}`);
                    }

                    // ===== KHÔNG CẬP NHẬT DATABASE Ở ĐÂY =====
                    // Database đã được cập nhật ở IPN rồi
                    // Chỉ cần kiểm tra trạng thái và chuyển user
                    
                    console.log('ℹ️ Callback: Order status:', {
                        orderId: order._id,
                        paymentStatus: order.paymentStatus,
                        status: order.status
                    });

                    // ===== CHUYỂN USER ĐẾN TRANG THÀNH CÔNG =====
                    const successUrl = `${process.env.CLIENT_URL}/order-success?orderId=${orderId}&orderNumber=${order.orderNumber}&from=momo&transId=${transId}`;
                    
                    console.log('🎉 Redirecting user to success page:', successUrl);
                    return res.redirect(successUrl);

                } catch (orderError) {
                    console.error('❌ Callback: Error checking order:', orderError);
                    return res.redirect(`${process.env.CLIENT_URL}/payment/failed?orderId=${orderId}&reason=order_check_failed`);
                }

            } else {
                // ❌ THANH TOÁN THẤT BẠI
                console.log('❌ Callback: Payment failed:', {
                    orderId,
                    resultCode,
                    message
                });

                // ===== CHUYỂN USER ĐẾN TRANG THẤT BẠI =====
                const failedUrl = `${process.env.CLIENT_URL}/payment/failed?orderId=${orderId}&reason=${encodeURIComponent(message)}&resultCode=${resultCode}`;
                
                console.log('💔 Redirecting user to failed page:', failedUrl);
                return res.redirect(failedUrl);
            }

        } catch (error) {
            console.error('❌ MoMo Callback Error:', error);
            
            // ===== XỬ LÝ LỖI HỆ THỐNG =====
            const errorUrl = `${process.env.CLIENT_URL}/payment/failed?reason=system_error&error=${encodeURIComponent(error.message)}`;
            
            return res.redirect(errorUrl);
        }
    }

    /**
     * 📞 IPN TỪ MOMO (SERVER-TO-SERVER WEBHOOK)
     * 
     * KHÁC BIỆT VỚI CALLBACK:
     * - Callback: MoMo chuyển hướng user (có thể bị user tắt trình duyệt)
     * - IPN: MoMo server gọi trực tiếp đến server (đáng tin cậy 100%)
     * 
     * FLOW:
     * 1. User thanh toán xong
     * 2. MoMo server tự động POST đến URL này
     * 3. Backend xử lý và trả về "OK" cho MoMo
     * 
     * ENDPOINT: POST /payment/momo/ipn
     * INPUT: Body từ MoMo server
     * OUTPUT: JSON { resultCode: 0, message: "Success" }
     */
    @Post('momo/ipn')
    async momoIPN(@Body() body: any) {
        try {
            console.log('=== MoMo IPN Debug ===');
            console.log('📞 MoMo IPN received:', body);

            // ===== BƯỚC 1: XÁC THỰC SIGNATURE =====
            // const isValidSignature = this.momoService.verifySignature(body);
            const isValidSignature = true; // TODO: Bật lại sau khi test xong
            console.log('🔐 IPN Signature valid:', isValidSignature);

            if (!isValidSignature) {
                console.log('❌ Invalid IPN signature');
                // Trả về lỗi cho MoMo biết signature không hợp lệ
                return { resultCode: 1, message: 'Invalid signature' };
            }

            // ===== BƯỚC 2: LẤY THÔNG TIN =====
            const orderId = body.orderId;
            const resultCode = body.resultCode; // Số, không phải string như callback

            console.log(`IPN: Processing payment result: orderId=${orderId}, resultCode=${resultCode}`);

            // ===== BƯỚC 3: XỬ LÝ KẾT QUẢ =====
            if (resultCode === 0) { // Số 0, không phải string '0'
                // ✅ THANH TOÁN THÀNH CÔNG
                console.log('✅ IPN: Payment successful for order:', orderId);

                try {
                    // Kiểm tra đơn hàng tồn tại
                    const order = await this.orderService.findOne(orderId);
                    if (!order) {
                        console.log('⚠️ IPN: Order not found, but payment was successful:', orderId);
                        // Vẫn trả về OK cho MoMo vì thanh toán đã thành công
                        return { resultCode: 0, message: 'Order not found but payment noted' };
                    }

                    // ===== CẬP NHẬT TRẠNG THÁI (CHỈ NẾU CHƯA CẬP NHẬT) =====
                    // Tránh cập nhật nhiều lần nếu cả callback và IPN đều chạy
                    if (order.paymentStatus !== PaymentStatus.PAID) {
                        await this.orderService.update(orderId, {
                            paymentStatus: PaymentStatus.PAID,
                            status: OrderStatus.CONFIRMED,
                            note: (order.note || '') + ` | Đã thanh toán qua MoMo - TransID: ${body.transId || 'N/A'}`
                        });

                        console.log('✅ IPN: Order updated to PAID & CONFIRMED');
                    } else {
                        console.log('ℹ️ IPN: Order already marked as PAID');
                    }

                } catch (updateError) {
                    console.error('❌ IPN: Error updating order:', updateError);
                    // Trả về lỗi cho MoMo
                    return { resultCode: 1, message: 'Update failed' };
                }

            } else {
                // ❌ THANH TOÁN THẤT BẠI
                console.log('❌ IPN: Payment failed for order:', orderId);

                try {
                    await this.orderService.update(orderId, {
                        paymentStatus: PaymentStatus.FAILED,
                        note: `Thanh toán MoMo thất bại: ${body.message || 'Unknown error'}`
                    });

                    console.log('✅ IPN: Order updated to FAILED');
                } catch (updateError) {
                    console.error('⚠️ IPN: Error updating failed payment status:', updateError);
                }
            }

            // ===== BƯỚC 4: TRẢ VỀ SUCCESS CHO MOMO =====
            // QUAN TRỌNG: Phải trả về resultCode: 0 để MoMo biết đã nhận được thông báo
            // Nếu không trả về hoặc trả về lỗi, MoMo sẽ gửi lại IPN nhiều lần
            return { resultCode: 0, message: 'Success' };

        } catch (error) {
            console.error('❌ MoMo IPN Error:', error);
            // Trả về lỗi cho MoMo
            return { resultCode: 1, message: 'Error' };
        }
    }

    /**
     * 💳 TẠO THANH TOÁN VNPAY
     */
    @Post('vnpay/create')
    async createVNPayPayment(
        @Body() createPaymentDto: {
            orderId: string;
            amount: number;
            orderInfo?: string;
        },
        @Request() req: any
    ) {
        try {
            const { orderId, amount, orderInfo } = createPaymentDto;
            const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';

            console.log('🏪 Creating VNPay payment for order:', orderId);

            // Kiểm tra đơn hàng (giống MoMo)
            const order = await this.orderService.findOne(orderId);
            if (!order) {
                throw new BadRequestException('Đơn hàng không tồn tại');
            }

            if (order.paymentStatus === PaymentStatus.PAID) {
                throw new BadRequestException('Đơn hàng đã được thanh toán');
            }

            if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
                throw new BadRequestException('Đơn hàng không thể thanh toán ở trạng thái hiện tại');
            }

            // Tạo VNPay payment
            const vnpayResponse = await this.vnpayService.createPayment(
                orderId,
                amount,
                orderInfo || `Thanh toán đơn hàng ${order.orderNumber}`,
                clientIp
            );

            console.log('📤 VNPay response:', vnpayResponse);

            if (vnpayResponse.success) {
                return {
                    success: true,
                    message: 'Tạo thanh toán VNPay thành công',
                    data: {
                        payUrl: vnpayResponse.payUrl,
                        orderId: orderId,
                        orderNumber: order.orderNumber,
                        amount: amount
                    }
                };
            } else {
                throw new BadRequestException(`Lỗi VNPay: ${vnpayResponse.message}`);
            }

        } catch (error) {
            console.error('❌ Create VNPay payment error:', error);
            throw new BadRequestException(error.message || 'Không thể tạo thanh toán VNPay');
        }
    }

    /**
     * 🔄 CALLBACK TỪ VNPAY
     */
    @Get('vnpay/callback')
    async vnpayCallback(@Query() query: any, @Res() res: Response) {
        try {
            console.log('=== VNPay Callback Debug ===');
            console.log('📞 VNPay Callback received:', query);

            const orderId = query.vnp_TxnRef?.split('_')[0]; // Lấy orderId từ vnp_TxnRef
            const responseCode = query.vnp_ResponseCode;

            if (!orderId) {
                return res.redirect(`${process.env.CLIENT_URL}/payment/failed?reason=missing_order_id`);
            }

            // Xác thực signature
            const isValidSignature = this.vnpayService.verifyCallback(query);
            if (!isValidSignature) {
                console.log('❌ Invalid VNPay callback signature');
                return res.redirect(`${process.env.CLIENT_URL}/payment/failed?reason=invalid_signature`);
            }

            if (responseCode === '00') {
                // Thành công
                console.log('✅ VNPay Callback: Payment successful for order:', orderId);
                
                const order = await this.orderService.findOne(orderId);
                if (!order) {
                    return res.redirect(`${process.env.CLIENT_URL}/payment/failed?reason=order_not_found`);
                }

                const successUrl = `${process.env.CLIENT_URL}/order-success?orderId=${orderId}&orderNumber=${order.orderNumber}&from=vnpay&transId=${query.vnp_TransactionNo}`;
                return res.redirect(successUrl);
            } else {
                // Thất bại
                console.log('❌ VNPay Callback: Payment failed:', responseCode);
                const failedUrl = `${process.env.CLIENT_URL}/payment/failed?orderId=${orderId}&reason=vnpay_error&code=${responseCode}`;
                return res.redirect(failedUrl);
            }

        } catch (error) {
            console.error('❌ VNPay Callback Error:', error);
            return res.redirect(`${process.env.CLIENT_URL}/payment/failed?reason=system_error`);
        }
    }

    /**
     * 📞 IPN TỪ VNPAY
     */
    @Post('vnpay/ipn')
    async vnpayIPN(@Body() body: any, @Query() query: any) {
        try {
            console.log('=== VNPay IPN Debug ===');
            console.log('📞 VNPay IPN received:', query);

            // VNPay gửi data qua query params, không phải body
            const params = query;
            const orderId = params.vnp_TxnRef?.split('_')[0];
            const responseCode = params.vnp_ResponseCode;

            // Xác thực signature
            const isValidSignature = this.vnpayService.verifyCallback(params);
            if (!isValidSignature) {
                return { RspCode: '97', Message: 'Invalid signature' };
            }

            if (responseCode === '00') {
                // Thanh toán thành công
                const order = await this.orderService.findOne(orderId);
                if (order && order.paymentStatus !== PaymentStatus.PAID) {
                    await this.orderService.update(orderId, {
                        paymentStatus: PaymentStatus.PAID,
                        status: OrderStatus.CONFIRMED,
                        note: (order.note || '') + ` | Đã thanh toán qua VNPay - TransID: ${params.vnp_TransactionNo}`
                    });
                    console.log('✅ VNPay IPN: Order updated to PAID');
                }
            } else {
                // Thanh toán thất bại
                await this.orderService.update(orderId, {
                    paymentStatus: PaymentStatus.FAILED,
                    note: `Thanh toán VNPay thất bại - Code: ${responseCode}`
                });
                console.log('❌ VNPay IPN: Order updated to FAILED');
            }

            return { RspCode: '00', Message: 'Success' };

        } catch (error) {
            console.error('❌ VNPay IPN Error:', error);
            return { RspCode: '99', Message: 'Error' };
        }
    }

    /**
     * 🔍 KIỂM TRA TRẠNG THÁI THANH TOÁN
     * 
     * Frontend có thể gọi API này để kiểm tra trạng thái thanh toán của đơn hàng
     * Ví dụ: Sau khi user quay về từ MoMo, frontend gọi API này để cập nhật UI
     * 
     * ENDPOINT: GET /payment/status/:orderId
     * INPUT: orderId trong URL params
     * OUTPUT: Thông tin trạng thái thanh toán
     */
    @Get('status/:orderId')
    async getPaymentStatus(@Param('orderId') orderId: string) {
        try {
            // Lấy thông tin đơn hàng
            const order = await this.orderService.findOne(orderId);
            if (!order) {
                throw new BadRequestException('Đơn hàng không tồn tại');
            }

            // Trả về thông tin trạng thái
            return {
                success: true,
                data: {
                    orderId: order._id,                    // ID đơn hàng
                    orderNumber: order.orderNumber,       // Mã đơn hàng
                    paymentStatus: order.paymentStatus,   // Trạng thái thanh toán
                    paymentMethod: order.paymentMethod,   // Phương thức thanh toán
                    status: order.status,                 // Trạng thái đơn hàng
                    total: order.total                    // Tổng tiền
                }
            };
        } catch (error) {
            throw new BadRequestException(error.message || 'Không thể lấy trạng thái thanh toán');
        }
    }
}