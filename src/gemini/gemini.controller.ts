import { Controller, Post, Body, Get } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { GoogleGenAI } from '@google/genai';

@Controller('gemini')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('chat')
  async chat(@Body('message') message: string) {
    console.log('📥 Received message:', message);
    console.log('📥 Message type:', typeof message);

    if (!message || typeof message !== 'string') {
      console.error('❌ Invalid message:', message);
      return {
        response: 'Vui lòng nhập tin nhắn.',
        products: [],
        isProductQuery: false
      };
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return {
        response: 'Vui lòng nhập tin nhắn.',
        products: [],
        isProductQuery: false
      };
    }

    try {
      console.log('✅ Processing message:', trimmedMessage);
      return await this.geminiService.chatWithProducts(trimmedMessage);
    } catch (error) {
      console.error('❌ Controller Error:', error);
      return {
        response: 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.',
        products: [],
        isProductQuery: false
      };
    }
  }

  @Get('debug-models')
  async debugModels() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return { status: 'ERROR', message: 'Chưa cấu hình GEMINI_API_KEY trong .env' };
    }

    // ✅ FIX: Dùng GoogleGenAI thay vì GoogleGenerativeAI
    const genAI = new GoogleGenAI({ apiKey });

    const modelsToTest = [
      'gemini-2.0-flash',          // ✅ Thêm model mới
      'text-embedding-004'
    ];

    const results: any[] = []; 

    console.log('🚀 Bắt đầu test các model...');

    for (const modelName of modelsToTest) {
      try {
        let responseText = '';

        if (modelName.includes('embedding')) {
          // ✅ FIX: Cú pháp embedContent đúng với @google/genai
          const result = await genAI.models.embedContent({
            model: modelName,
            contents: [{ parts: [{ text: 'Test embedding' }] }]
          });
          // ✅ FIX: Lấy từ embeddings[0].values
          const vectorLength = result.embeddings?.[0]?.values?.length;
          responseText = `OK (Vector length: ${vectorLength || 'unknown'})`;
        } else {
          // ✅ FIX: Cú pháp generateContent đúng với @google/genai
          const result = await genAI.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: 'Say Hello' }] }]
          });
          // ✅ FIX: Lấy từ result.text (không phải result.response.text)
          responseText = result.text || 'No response';
        }

        results.push({
          model: modelName,
          status: '✅ WORKING', 
          message: responseText.substring(0, 50) 
        });
        console.log(`✅ ${modelName}: OK`); 

      } catch (error: any) {
        let errorMsg = error.message || 'Unknown error';
        let status = '❌ ERROR';

        if (errorMsg.includes('404')) status = '❌ NOT FOUND (Sai tên model)';
        if (errorMsg.includes('403')) status = '❌ PERMISSION (Key lỗi hoặc bị chặn vùng)';
        if (errorMsg.includes('429')) status = '❌ QUOTA (Hết lượt dùng)';

        results.push({
          model: modelName,
          status: status,
          error: errorMsg
        });
        console.error(`❌ ${modelName}: ${status}`); 
      }
    }

    return {
      apiKeyCheck: 'OK',
      totalTested: modelsToTest.length,
      details: results
    };
  }
}