import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProductsService } from '../products/products.service';

type ChatResult = {
    response: string;
    products?: any[];
    isProductQuery: boolean;
};

@Injectable()
export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private readonly logger = new Logger(GeminiService.name);
    
    // ✅ CẬP NHẬT: Sử dụng Gemini 2.0 Flash
    private readonly MODEL_CANDIDATES = [
        'gemini-2.0-flash-exp',           // Gemini 2.0 Flash (experimental)
        'gemini-1.5-flash',                // Fallback 1
        'gemini-1.5-flash-8b',             // Fallback 2
    ];

    // ✅ EMBEDDING MODEL giữ nguyên
    private readonly EMBEDDING_MODEL = 'text-embedding-004';

    // Retry config
    private readonly MAX_RETRIES = 3;
    private readonly INITIAL_DELAY_MS = 1500;
    private readonly BACKOFF_FACTOR = 2;

    constructor(
        @Inject(forwardRef(() => ProductsService))
        private productsService: ProductsService
    ) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not configured in environment variables');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    async chatWithProducts(userMessage: string): Promise<ChatResult> {
        try {
            // 1) Chuẩn bị dữ liệu sản phẩm (giới hạn context để tránh prompt quá dài)
            const allProducts = await this.productsService.findAll();
            const productsContext = (allProducts || [])
                .slice(0, 30)
                .map((p: any) => ({
                    id: p._id?.toString?.() ?? String(p._id),
                    name: p.name,
                    price: p.price,
                    sold: p.sold ?? undefined, // nếu có
                    description: p.description || '',
                    categoryId: p.categoryId ?? undefined,
                }));

            // 2) Prompt yêu cầu trả về JSON THUẦN
            const prompt = this.buildPrompt(productsContext, userMessage);

            // 3) Gọi Gemini có retry + fallback model
            const aiResponseText = await this.generateWithRetryAndFallback(prompt);

            // 4) Parse JSON an toàn
            const parsed = this.safeParseJson(aiResponseText);

            if (parsed?.isProductQuery && Array.isArray(parsed.productIds)) {
                // Lấy sản phẩm theo id AI trả về
                const idSet = new Set(parsed.productIds.map((x: any) => String(x)));
                const recommendedProducts = (allProducts || [])
                    .filter((p: any) => idSet.has(String(p._id)))
                    .map((p: any) => ({
                        _id: p._id,
                        id: p._id?.toString?.() ?? String(p._id),
                        name: p.name,
                        price: p.price,
                        description: p.description,
                        image:
                            p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls[0] : null,
                        categoryId: p.categoryId,
                        subcategoryId: p.subcategoryId || '',
                        createdAt: p.createdAt,
                    }));

                return {
                    response: String(parsed.response ?? ''),
                    products: recommendedProducts,
                    isProductQuery: true,
                };
            }

            // Không phải câu hỏi sản phẩm → trả lời tự nhiên
            return {
                response: String(parsed?.response ?? aiResponseText ?? ''),
                isProductQuery: false,
            };
        } catch (err) {
            // Không throw nữa để UI không “đỏ”, trả về fallback thân thiện
            console.error('[GeminiService] Fallback error:', err);
            return {
                response:
                    'Xin lỗi, hệ thống AI đang bận. Bạn có thể thử lại sau ít phút hoặc mô tả rõ nhu cầu để mình gợi ý nhanh hơn nhé.',
                isProductQuery: false,
            };
        }
    }

    async createEmbedding(text: string): Promise<number[]> {
        try {
            console.log(`🧠 Tạo vector cho: "${text}"`);

            // Gọi Gemini API
            const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
            const result = await model.embedContent(text);
            
            // Lấy vector
            const vector = result.embedding.values;
            
            console.log(`✅ Tạo được vector có ${vector.length} chiều`);
            return vector;

        } catch (error) {
            console.error('❌ Lỗi tạo vector:', error);
            throw new Error(`Không thể tạo vector: ${error.message}`);
        }
    }

    /**
     * 📊 CALCULATE SIMILARITY BETWEEN 2 VECTORS (COSINE SIMILARITY)
     */
    calculateSimilarity(vector1: number[], vector2: number[]): number {
        // Check if vectors have same length
        if (vector1.length !== vector2.length) {
            throw new Error('Vectors must have the same length');
        }

        // Calculate cosine similarity
        let dotProduct = 0;    // A · B
        let magnitudeA = 0;    // |A|
        let magnitudeB = 0;    // |B|

        for (let i = 0; i < vector1.length; i++) {
            dotProduct += vector1[i] * vector2[i];
            magnitudeA += vector1[i] * vector1[i];
            magnitudeB += vector2[i] * vector2[i];
        }

        // Avoid division by zero
        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }

        // Cosine similarity = (A·B) / (|A| × |B|)
        const similarity = dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
        
        // Ensure result is between 0 and 1
        return Math.max(0, similarity);
    }


    // ---------- Helpers ----------

    private buildPrompt(productsContext: any[], userMessage: string) {
        // Yêu cầu trả về JSON THUẦN (không markdown, không text ngoài JSON)
        // và nêu rõ schema kỳ vọng để model “vào khuôn”
        return `
Bạn là trợ lý AI của cửa hàng TpShop (điện thoại & laptop).

SẢN PHẨM HIỆN CÓ (rút gọn):
${JSON.stringify(productsContext, null, 2)}

YÊU CẦU:
- Phân tích CÂU HỎI của khách sau đây.
- Nếu câu hỏi LIÊN QUAN SẢN PHẨM (tìm kiếm/so sánh/tư vấn):
  * Soạn nội dung tư vấn ngắn gọn, định dạng liệt kê theo mẫu:
    - Tên sản phẩm
    - Giá: [giá] VNĐ
    - Đã bán: [số lượng] chiếc (nếu biết)
  * Chỉ định danh sách sản phẩm chọn ra bằng mảng productIds (id đúng như trong dữ liệu).
  * Trả về JSON theo SCHEMA:
    {
      "isProductQuery": true,
      "response": "nội dung tư vấn liệt kê",
      "productIds": ["id1", "id2", "..."]
    }

- Nếu KHÔNG liên quan sản phẩm:
  * Trả về JSON:
    {
      "isProductQuery": false,
      "response": "câu trả lời tự nhiên, thân thiện"
    }

QUY TẮC BẮT BUỘC:
- CHỈ TRẢ VỀ **JSON THUẦN** đúng một đối tượng, không kèm bất kỳ ký tự/thẻ/markdown nào khác.
- Không được thêm \`\`\`json hoặc văn bản bên ngoài JSON.

CÂU HỎI CỦA KHÁCH: ${JSON.stringify(userMessage)}
`.trim();
    }

    private async generateWithRetryAndFallback(prompt: string): Promise<string> {
        let lastError: any;

        for (const modelName of this.MODEL_CANDIDATES) {
            const model = this.genAI.getGenerativeModel({ model: modelName });

            // retry vòng tròn cho từng model
            let delay = this.INITIAL_DELAY_MS;

            for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
                try {
                    const res = await model.generateContent({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    });
                    const text = res?.response?.text?.();
                    if (!text || typeof text !== 'string') {
                        throw new Error('Empty response text');
                    }
                    return text;
                } catch (error: any) {
                    // Lưu error cuối
                    lastError = error;

                    const status = (error && (error.status || error.code)) ?? undefined;
                    const isOverloaded =
                        status === 503 ||
                        // một số lỗi mạng không có status → coi như tạm thời
                        error?.message?.includes?.('fetch') ||
                        error?.message?.includes?.('network') ||
                        error?.message?.includes?.('timeout');

                    const isLastAttempt = attempt === this.MAX_RETRIES;

                    // Log gọn
                    console.warn(
                        `[GeminiService] ${modelName} attempt ${attempt}/${this.MAX_RETRIES} failed:`,
                        status || error?.message || error,
                    );

                    if (!isOverloaded || isLastAttempt) {
                        // Không phải lỗi tạm thời hoặc đã hết lượt thử → chuyển model tiếp theo / thoát
                        break;
                    }

                    // Exponential backoff + jitter
                    const jitter = Math.floor(Math.random() * 400);
                    await new Promise((r) => setTimeout(r, delay + jitter));
                    delay *= this.BACKOFF_FACTOR;
                }
            }

            // nếu fail hết retry cho model hiện tại → thử model kế
            console.warn(`[GeminiService] Switch fallback model after failures: ${modelName}`);
        }

        // Hết cả fallback model
        throw lastError ?? new Error('Gemini generation failed after retries & fallbacks');
    }

    private safeParseJson(raw: string) {
        if (!raw) return null;

        // Loại bỏ code blocks ```json ... ```
        let s = raw.replace(/```json\s*([\s\S]*?)\s*```/gi, '$1').trim();
        s = s.replace(/```([\s\S]*?)```/g, '$1').trim();

        // Nếu có text lẫn lộn, cố gắng trích JSON khối đầu tiên
        // Tìm dấu { ... } ngoài cùng
        const firstCurly = s.indexOf('{');
        const lastCurly = s.lastIndexOf('}');
        if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
            s = s.slice(firstCurly, lastCurly + 1).trim();
        }

        try {
            const obj = JSON.parse(s);

            // Chuẩn hoá kiểu dữ liệu tối thiểu
            if (typeof obj?.isProductQuery !== 'boolean') {
                obj.isProductQuery = !!obj?.productIds;
            }
            if (obj?.productIds && !Array.isArray(obj.productIds)) {
                obj.productIds = [String(obj.productIds)];
            }
            return obj;
        } catch (e) {
            console.warn('[GeminiService] JSON parse failed. Raw response:', raw);
            return { isProductQuery: false, response: raw };
        }
    }


}
