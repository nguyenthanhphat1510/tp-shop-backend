import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MomoService {
  private readonly logger = new Logger(MomoService.name);
  
  // 🔑 THÔNG TIN XÁC THỰC MOMO (TEST ENVIRONMENT)
  // Đây là credentials công khai của MoMo để test - ai cũng có thể dùng
  private readonly accessKey = 'F8BBA842ECF85';          // Khóa truy cập (như username)
  private readonly secretKey = 'K951B6PE1waDMi640xX08PD3vg6EkVlz'; // Khóa bí mật (như password)
  private readonly partnerCode = 'MOMO';                  // Mã đối tác cố định
  
  // 🌐 ENDPOINT API MOMO TEST
  private readonly endpoint = 'https://test-payment.momo.vn/v2/gateway/api/create';
  
  constructor(private readonly httpService: HttpService) {}

  /**
   * 💰 TẠO GIAO DỊCH THANH TOÁN MOMO
   * @param orderId - Mã đơn hàng (phải unique)
   * @param amount - Số tiền (VNĐ)
   * @param orderInfo - Thông tin đơn hàng
   * @returns Object chứa payUrl để user thanh toán
   */
  async createPayment(orderId: string, amount: number, orderInfo: string) {
    try {
      // 📋 BƯỚC 1: CHUẨN BỊ DỮ LIỆU CƠ BẢN
      
      // Tạo ID duy nhất cho request này (format: MOMO_timestamp)
      const requestId = `${this.partnerCode}_${Date.now()}`;
      
      // URL user sẽ được chuyển về sau khi thanh toán (success/fail)
      const redirectUrl = 'http://localhost:3001/api/payment/momo/callback';
      
      // URL MoMo sẽ gửi thông báo kết quả đến server (callback)
      const ipnUrl = 'http://localhost:3001/api/payment/momo/ipn';
      
      // 🔐 BƯỚC 2: TẠO CHỮ KÝ (SIGNATURE) - QUAN TRỌNG NHẤT!
      // Signature như "dấu vân tay" để MoMo biết request từ chúng ta
      const rawSignature = this.createRawSignature({
        accessKey: this.accessKey,       // Khóa truy cập
        amount: amount.toString(),       // Số tiền (phải là string)
        extraData: '',                   // Dữ liệu thêm (để trống)
        ipnUrl,                         // URL callback
        orderId,                        // Mã đơn hàng
        orderInfo,                      // Thông tin đơn hàng
        partnerCode: this.partnerCode,  // Mã đối tác
        redirectUrl,                    // URL chuyển hướng
        requestId,                      // ID request
        requestType: 'payWithMethod'    // Loại thanh toán
      });
      
      // Mã hóa rawSignature bằng secretKey để tạo signature cuối cùng
      const signature = this.generateSignature(rawSignature);
      
      // 📦 BƯỚC 3: TẠO REQUEST BODY GỬI CHO MOMO
      const requestBody = {
        partnerCode: this.partnerCode,    // Mã đối tác
        partnerName: "TpShop",           // Tên đối tác (tự đặt)
        storeId: "TpShop_Store",         // Mã cửa hàng (tự đặt)
        requestId,                       // ID request duy nhất
        amount: amount.toString(),       // Số tiền (string)
        orderId,                         // Mã đơn hàng
        orderInfo,                       // Thông tin đơn hàng
        redirectUrl,                     // URL user được chuyển về
        ipnUrl,                         // URL nhận callback
        lang: 'vi',                     // Ngôn ngữ (tiếng Việt)
        requestType: 'payWithMethod',   // Loại thanh toán
        autoCapture: true,              // Tự động capture tiền
        extraData: '',                  // Dữ liệu thêm
        signature                       // Chữ ký quan trọng nhất!
      };
      
      // 🚀 BƯỚC 4: GỬI REQUEST ĐẾN MOMO API
      console.log('📤 Sending request to MoMo:', JSON.stringify(requestBody, null, 2));
      
      const response = await firstValueFrom(
        this.httpService.post(this.endpoint, requestBody)
      );
      
      console.log('📥 Response from MoMo:', JSON.stringify(response.data, null, 2));
      
      // ✅ BƯỚC 5: XỬ LÝ KẾT QUẢ TỪ MOMO
      if (response.data.resultCode === 0) {
        // Thành công - MoMo trả về link thanh toán
        return {
          success: true,
          payUrl: response.data.payUrl,    // 🔗 Link này user vào để thanh toán
          orderId: orderId,
          amount: amount,
          message: 'Tạo thanh toán thành công'
        };
      } else {
        // Lỗi - MoMo từ chối request
        throw new Error(`MoMo Error [${response.data.resultCode}]: ${response.data.message}`);
      }
      
    } catch (error) {
      // 🚨 XỬ LÝ LỖI
      this.logger.error('❌ Tạo thanh toán thất bại:', error.message);
      
      // Log thêm chi tiết nếu có response từ MoMo
      if (error.response?.data) {
        this.logger.error('MoMo Response:', JSON.stringify(error.response.data, null, 2));
      }
      
      throw new Error('Không thể tạo thanh toán MoMo: ' + error.message);
    }
  }

  /**
   * 🔗 TẠO RAW SIGNATURE (CHUỖI CHƯA MÃ HÓA)
   * Nối tất cả thông tin theo thứ tự alphabet
   * Ví dụ: "accessKey=abc&amount=100000&extraData=&ipnUrl=..."
   */
  private createRawSignature(params: Record<string, string>): string {
    const sortedParams = Object.keys(params)
      .sort()                                    // Sắp xếp theo alphabet (a->z)
      .map(key => `${key}=${params[key]}`)      // Tạo "key=value" 
      .join('&');                               // Nối bằng dấu &
    
    console.log('🔗 Raw signature:', sortedParams);
    return sortedParams;
  }

  /**
   * 🔐 TẠO SIGNATURE CUỐI CÙNG
   * Dùng HMAC SHA256 để mã hóa rawSignature với secretKey
   */
  private generateSignature(rawSignature: string): string {
    const signature = crypto
      .createHmac('sha256', this.secretKey)    // Tạo HMAC với SHA256
      .update(rawSignature)                    // Đưa rawSignature vào
      .digest('hex');                          // Xuất ra dạng hex (chuỗi)
    
    console.log('🔐 Generated signature:', signature);
    return signature;
  }

  /**
   * ✅ XÁC THỰC CALLBACK TỪ MOMO
   * Khi user thanh toán xong, MoMo sẽ gửi kết quả về ipnUrl
   * Cần verify signature để đảm bảo data thật từ MoMo
   */
  verifyCallback(data: any): boolean {
    try {
      console.log('🔍 Verifying MoMo callback:', JSON.stringify(data, null, 2));
      
      // Tạo lại rawSignature từ data callback (thứ tự cố định theo docs MoMo)
      const rawSignature = `accessKey=${data.accessKey}&amount=${data.amount}&extraData=${data.extraData}&message=${data.message}&orderId=${data.orderId}&orderInfo=${data.orderInfo}&orderType=${data.orderType}&partnerCode=${data.partnerCode}&payType=${data.payType}&requestId=${data.requestId}&responseTime=${data.responseTime}&resultCode=${data.resultCode}&transId=${data.transId}`;
      
      console.log('🔗 Callback raw signature:', rawSignature);
      
      // Tạo signature từ rawSignature
      const expectedSignature = this.generateSignature(rawSignature);
      
      console.log('🔐 Expected signature:', expectedSignature);
      console.log('📥 Received signature:', data.signature);
      
      // So sánh signature: giống = đúng từ MoMo, khác = có người giả mạo
      const isValid = data.signature === expectedSignature;
      
      console.log(isValid ? '✅ Signature valid' : '❌ Signature invalid');
      
      return isValid;
      
    } catch (error) {
      console.error('❌ Verify callback error:', error.message);
      return false;
    }
  }
}