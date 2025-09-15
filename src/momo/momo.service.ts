import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as https from 'https';

@Injectable()
export class MomoService {
  private readonly accessKey = 'F8BBA842ECF85';
  private readonly secretKey = 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
  private readonly partnerCode = 'MOMO';
  // Dùng biến môi trường
  private readonly redirectUrl = process.env.MOMO_REDIRECT_URL || 'http://localhost:3000/api/payment/momo/callback';
  private readonly ipnUrl = process.env.MOMO_IPN_URL || 'http://localhost:3000/api/payment/momo/ipn';

  async createPayment(orderId: string, amount: number, orderInfo: string): Promise<any> {
    const requestId = this.partnerCode + new Date().getTime();
    const extraData = '';
    const requestType = "payWithMethod";
    const autoCapture = true;
    const lang = 'vi';

    // Tạo raw signature
    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${this.ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${this.partnerCode}&redirectUrl=${this.redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    console.log("RAW SIGNATURE:", rawSignature);

    // Tạo signature
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    console.log("SIGNATURE:", signature);

    // Request body
    const requestBody = {
      partnerCode: this.partnerCode,
      partnerName: "TpShop",
      storeId: "TpShopStore",
      requestId: requestId,
      amount: amount.toString(),
      orderId: orderId,
      orderInfo: orderInfo,
      redirectUrl: this.redirectUrl,
      ipnUrl: this.ipnUrl,
      lang: lang,
      requestType: requestType,
      autoCapture: autoCapture,
      extraData: extraData,
      signature: signature
    };

    // Gửi request đến MoMo
    return new Promise((resolve, reject) => {
      const requestBodyStr = JSON.stringify(requestBody);
      
      const options = {
        hostname: 'test-payment.momo.vn',
        port: 443,
        path: '/v2/gateway/api/create',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBodyStr)
        }
      };

      const req = https.request(options, (res) => {
        console.log(`Status: ${res.statusCode}`);
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('MoMo Response:', response);
            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error('MoMo Request Error:', error);
        reject(error);
      });

      console.log("Sending to MoMo...", requestBodyStr);
      req.write(requestBodyStr);
      req.end();
    });
  }

  // Verify callback từ MoMo
  verifySignature(data: any): boolean {
    const {
      accessKey,
      amount,
      extraData,
      message,
      orderId,
      orderInfo,
      orderType,
      partnerCode,
      payType,
      requestId,
      responseTime,
      resultCode,
      transId,
      signature
    } = data;

    // Raw signature cho callback (khác với khi tạo payment)
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    console.log("Callback Raw Signature:", rawSignature);

    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    console.log("Expected Signature:", expectedSignature);
    console.log("Received Signature:", signature);
    console.log("Signature Match:", signature === expectedSignature);

    return signature === expectedSignature;
  }
}