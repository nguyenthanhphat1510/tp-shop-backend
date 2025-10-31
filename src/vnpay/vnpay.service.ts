import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';
import moment from 'moment';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class VNPayService {
    private readonly logger = new Logger(VNPayService.name);

    // 🔑 THÔNG TIN XÁC THỰC VNPAY (TEST ENVIRONMENT)
    private readonly tmnCode = '9IE1B02V';                    // Terminal ID (test)
    private readonly secretKey = 'K7LTHAOOFVNVBYF6WVPGAIIH0OWO0JR9'; // Secret key (test)
    private readonly vnpUrl = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'; // Test URL
    private readonly returnUrl = 'http://localhost:3001/api/payment/vnpay/callback';
    private readonly ipnUrl = 'http://localhost:3001/api/payment/vnpay/ipn';

    constructor(private readonly httpService: HttpService) { }

    /**
     * 💰 TẠO GIAO DỊCH THANH TOÁN VNPAY
     */
    async createPayment(orderId: string, amount: number, orderInfo: string, clientIp: string = '127.0.0.1') {
        try {
            // 📋 BƯỚC 1: CHUẨN BỊ DỮ LIỆU
            const vnpTxnRef = `${orderId}_${Date.now()}`; // Mã giao dịch unique
            const vnpCreateDate = moment().format('YYYYMMDDHHmmss'); // Thời gian tạo
            const vnpExpireDate = moment().add(15, 'minutes').format('YYYYMMDDHHmmss'); // Hết hạn sau 15 phút

            // 📦 BƯỚC 2: TẠO PARAMS
            const vnpParams: Record<string, string> = {
                vnp_Version: '2.1.0',
                vnp_Command: 'pay',
                vnp_TmnCode: this.tmnCode,
                vnp_Amount: (amount * 100).toString(),
                vnp_CurrCode: 'VND',
                vnp_TxnRef: vnpTxnRef,
                vnp_OrderInfo: orderInfo,
                vnp_OrderType: 'other',
                vnp_Locale: 'vn',
                vnp_ReturnUrl: this.returnUrl,  // URL user được redirect
                vnp_IpnUrl: this.ipnUrl,        // ✅ THÊM DÒNG NÀY - URL server nhận thông báo
                vnp_IpAddr: clientIp,
                vnp_CreateDate: vnpCreateDate,
                vnp_ExpireDate: vnpExpireDate
            };

            // 🔐 BƯỚC 3: TẠO SIGNATURE
            const signData = this.createSignData(vnpParams);
            const signature = this.generateSignature(signData);
            vnpParams['vnp_SecureHash'] = signature;

            // 🔗 BƯỚC 4: TẠO URL THANH TOÁN
            const paymentUrl = this.vnpUrl + '?' + new URLSearchParams(vnpParams).toString();

            console.log('📤 VNPay payment URL created:', paymentUrl);

            return {
                success: true,
                payUrl: paymentUrl,
                orderId: orderId,
                amount: amount,
                message: 'Tạo thanh toán thành công'
            };

        } catch (error) {
            this.logger.error('❌ Tạo thanh toán VNPay thất bại:', error.message);
            throw new Error('Không thể tạo thanh toán VNPay: ' + error.message);
        }
    }

    /**
     * 🔗 TẠO SIGN DATA (CHUỖI CHƯA MÃ HÓA)
     */
    private createSignData(params: Record<string, string>): string {
        // Loại bỏ vnp_SecureHash và sắp xếp alphabet
        const sortedParams = Object.keys(params)
            .filter(key => key !== 'vnp_SecureHash')
            .sort()
            .map(key => `${key}=${encodeURIComponent(params[key])}`)
            .join('&');

        console.log('🔗 VNPay sign data:', sortedParams);
        return sortedParams;
    }

    /**
     * 🔐 TẠO SIGNATURE
     */
    private generateSignature(signData: string): string {
        const signature = crypto
            .createHmac('sha512', this.secretKey)
            .update(signData)
            .digest('hex');

        console.log('🔐 VNPay signature:', signature);
        return signature;
    }

    /**
     * ✅ XÁC THỰC CALLBACK/IPN TỪ VNPAY
     */
    verifyCallback(params: Record<string, string>): boolean {
        try {
            const receivedSignature = params['vnp_SecureHash'];
            delete params['vnp_SecureHash']; // Xóa signature trước khi tạo lại

            const signData = this.createSignData(params);
            const expectedSignature = this.generateSignature(signData);

            const isValid = receivedSignature === expectedSignature;
            console.log(isValid ? '✅ VNPay signature valid' : '❌ VNPay signature invalid');

            return isValid;
        } catch (error) {
            console.error('❌ Verify VNPay callback error:', error.message);
            return false;
        }
    }
}