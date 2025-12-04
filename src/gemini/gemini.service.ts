import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
// ✅ Thay đổi import thư viện mới
import { GoogleGenAI } from '@google/genai';
import { ProductsService } from '../products/products.service';

type ChatResult = {
    response: string;
    products?: any[];
    isProductQuery: boolean;
};

@Injectable()
export class GeminiService {
    // ✅ Đổi kiểu dữ liệu
    private genAI: GoogleGenAI;
    private readonly logger = new Logger(GeminiService.name);

    // ✅ CONFIG: Thêm model Gemini 2.0 vào đầu danh sách ưu tiên
    private readonly MODEL_CANDIDATES = [
        'gemini-2.0-flash',        // ✅ Model mới (nhanh & thông minh hơn)
    ];
    private readonly EMBEDDING_MODEL = 'text-embedding-004';
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
        // ✅ Khởi tạo client theo cú pháp mới
        this.genAI = new GoogleGenAI({ apiKey });
    }

    // ========================================
    // 📌 PUBLIC METHODS (API CHO BÊN NGOÀI)
    // ========================================

    /**
     * 🤖 CHAT WITH RAG (RETRIEVAL-AUGMENTED GENERATION)
     * 
     * LUỒNG HOẠT ĐỘNG:
     * 1. Phân loại câu hỏi (sản phẩm hay chat thường)
     * 2. Nếu chat thường → trả lời template (nhanh)
     * 3. Nếu hỏi sản phẩm → RAG:
     *    a. Tạo embedding cho câu hỏi
     *    b. Vector search tìm top 10 sản phẩm liên quan
     *    c. Đưa vào context cho AI
     *    d. AI phân tích và đề xuất
     * 4. Trả về kết quả
     */
    async chatWithProducts(userMessage: string): Promise<ChatResult> {
        try {
            console.log(`\n🤖 === RAG CHATBOT START ===`);
            console.log(`💬 User question: "${userMessage}"`);
            const startTime = Date.now();

            // ===== BƯỚC 1: PHÂN LOẠI CÂU HỎI =====
            const isProductRelated = this.isProductRelatedQuery(userMessage);
            console.log(`📋 Is product related: ${isProductRelated}`);

            // ===== BƯỚC 2A: NẾU KHÔNG LIÊN QUAN SẢN PHẨM =====
            if (!isProductRelated) {
                const casualResponse = this.generateCasualResponse(userMessage);
                console.log(`✅ Casual chat completed in ${Date.now() - startTime}ms\n`);

                return {
                    response: casualResponse,
                    isProductQuery: false
                };
            }

            // ===== BƯỚC 2B: NẾU LIÊN QUAN SẢN PHẨM → RAG =====
            console.log(`🔍 Starting RAG retrieval...`);

            // RAG STEP 1: TẠO EMBEDDING
            const queryEmbedding = await this.createEmbedding(userMessage);
            console.log(`✅ Query embedding created (${queryEmbedding.length} dimensions)`);

            // RAG STEP 2: VECTOR SEARCH
            const searchResults = await this.productsService.searchByVector(userMessage);
            console.log(`📦 Found ${searchResults.totalFound} relevant variants`);

            // RAG STEP 3: CHUẨN BỊ CONTEXT
            const topVariants = searchResults.variants.slice(0, 10);
            const contextProducts = this.prepareContextProducts(topVariants);
            console.log(`📚 Context prepared with ${contextProducts.length} products`);

            // RAG STEP 4: TẠO PROMPT
            const ragPrompt = this.buildRAGPrompt(contextProducts, userMessage);

            // RAG STEP 5: GENERATE RESPONSE
            console.log(`🧠 Generating AI response with RAG context...`);
            const aiResponseText = await this.generateWithRetryAndFallback(ragPrompt);

            // RAG STEP 6: PARSE RESPONSE
            const parsed = this.safeParseJson(aiResponseText);

            // RAG STEP 7: LẤY FULL INFO SẢN PHẨM
            const recommendedProducts = this.extractRecommendedProducts(
                parsed?.productIds,
                topVariants
            );

            // RAG STEP 8: RETURN KẾT QUẢ
            const duration = Date.now() - startTime;
            console.log(`✅ RAG completed in ${duration}ms`);
            console.log(`✅ Recommended ${recommendedProducts.length} products`);
            console.log(`🤖 === RAG CHATBOT END ===\n`);

            return {
                response: String(parsed?.response || aiResponseText),
                products: recommendedProducts,
                isProductQuery: true
            };

        } catch (err) {
            console.error('❌ RAG Chatbot Error:', err);
            return {
                response: 'Xin lỗi, hệ thống AI đang bận. Bạn vui lòng thử lại sau ít phút nhé! 😊',
                isProductQuery: false
            };
        }
    }

    /**
     * 🧠 TẠO EMBEDDING (VECTOR) CHO TEXT
     */
    async createEmbedding(text: string): Promise<number[]> {
        try {
            console.log(`🧠 Tạo vector cho: "${text}"`);

            // ✅ FIX: Đổi 'content' thành 'contents' và bọc trong cấu trúc Content
            const result = await this.genAI.models.embedContent({
                model: this.EMBEDDING_MODEL,
                contents: [{ parts: [{ text: text }] }],
            });
            
            // ✅ FIX: Lấy values từ result.embeddings[0] (mảng thay vì object đơn)
            const vector = result.embeddings?.[0]?.values;

            if (!vector) throw new Error('Không nhận được vector từ API');

            console.log(`✅ Tạo được vector có ${vector.length} chiều`);
            return vector;

        } catch (error: any) {
            console.error('❌ Lỗi tạo vector:', error);
            throw new Error(`Không thể tạo vector: ${error.message}`);
        }
    }

    /**
     * 📊 TÍNH SIMILARITY GIỮA 2 VECTORS (COSINE SIMILARITY)
     */
    calculateSimilarity(vector1: number[], vector2: number[]): number {
        let dotProduct = 0;
        for (let i = 0; i < vector1.length; i++) {
            dotProduct += vector1[i] * vector2[i];
        }
        return dotProduct; // Vì vector đã chuẩn hóa
    }

    // ========================================
    // 🔒 PRIVATE METHODS - RAG WORKFLOW
    // ========================================

    /**
     * 🔍 PHÂN LOẠI CÂU HỎI
     * Kiểm tra câu hỏi có liên quan sản phẩm không
     */
    private isProductRelatedQuery(query: string): boolean {
        const lowerQuery = query.toLowerCase().trim();

        const productKeywords = [
            // Loại sản phẩm
            'điện thoại', 'smartphone', 'phone', 'mobile',
            'laptop', 'máy tính', 'macbook', 'notebook',
            'tablet', 'ipad',

            // Thương hiệu
            'iphone', 'samsung', 'oppo', 'xiaomi', 'vivo', 'realme',
            'asus', 'dell', 'hp', 'lenovo', 'acer', 'msi',
            'apple', 'huawei', 'nokia', 'sony',

            // Hành động mua sắm
            'giá', 'mua', 'bán', 'order', 'đặt', 'ship',
            'khuyến mãi', 'sale', 'giảm giá', 'ưu đãi', 'promotion',

            // Tư vấn
            'tư vấn', 'gợi ý', 'recommend', 'nên', 'chọn',
            'so sánh', 'compare', 'tốt hơn', 'khác', 'phù hợp',

            // Tìm kiếm
            'tìm', 'search', 'có', 'nào', 'loại', 'hãng', 'model',

            // Thông số kỹ thuật
            'ram', 'rom', 'bộ nhớ', 'storage', 'gb',
            'pin', 'battery', 'mah',
            'camera', 'máy ảnh', 'mp', 'megapixel',
            'màn hình', 'screen', 'display', 'inch',
            'chip', 'processor', 'cpu', 'snapdragon', 'exynos', 'a17',

            // Dung lượng
            '64gb', '128gb', '256gb', '512gb', '1tb',
            '4gb', '6gb', '8gb', '12gb', '16gb', '32gb',

            // Màu sắc
            'màu', 'color', 'đen', 'trắng', 'xanh', 'đỏ',
            'vàng', 'tím', 'hồng', 'bạc', 'xám', 'gold',
        ];

        const hasProductKeyword = productKeywords.some(keyword =>
            lowerQuery.includes(keyword)
        );

        const casualKeywords = [
            'xin chào', 'chào', 'hello', 'hi', 'hey',
            'cảm ơn', 'thanks', 'thank you', 'thanks you',
            'tạm biệt', 'bye', 'goodbye', 'see you',
            'bạn là ai', 'tên bạn', 'bạn tên gì', 'who are you',
            'thời tiết', 'weather', 'trời', 'mưa', 'nắng'
        ];

        const isCasualChat = casualKeywords.some(keyword =>
            lowerQuery.includes(keyword)
        );

        if (isCasualChat && !hasProductKeyword) {
            console.log(`💬 Casual chat detected: "${query}"`);
            return false;
        }

        if (hasProductKeyword) {
            console.log(`🛍️ Product query detected: "${query}"`);
            return true;
        }

        console.log(`❓ Unclear query, treating as casual: "${query}"`);
        return false;
    }

    /**
     * 💬 TRẢ LỜI CHAT THÔNG THƯỜNG (KHÔNG CẦN RAG)
     */
    private generateCasualResponse(query: string): string {
        const lowerQuery = query.toLowerCase().trim();

        if (lowerQuery.includes('xin chào') ||
            lowerQuery.includes('chào') ||
            lowerQuery.includes('hello') ||
            lowerQuery.includes('hi') ||
            lowerQuery.includes('hey')) {

            return 'Xin chào! Mình là trợ lý AI của TpShop. 👋\n\n' +
                'Mình có thể giúp bạn:\n' +
                '• Tìm kiếm điện thoại, laptop\n' +
                '• Tư vấn sản phẩm phù hợp\n' +
                '• So sánh giá và tính năng\n\n' +
                'Bạn cần tìm gì hôm nay? 😊';
        }

        if (lowerQuery.includes('cảm ơn') ||
            lowerQuery.includes('thanks') ||
            lowerQuery.includes('thank you')) {

            return 'Không có gì! Rất vui được hỗ trợ bạn. 😊\n\n' +
                'Nếu cần thêm thông tin về sản phẩm nào, cứ hỏi mình nhé!';
        }

        if (lowerQuery.includes('tạm biệt') ||
            lowerQuery.includes('bye') ||
            lowerQuery.includes('goodbye')) {

            return 'Tạm biệt! Chúc bạn một ngày tốt lành. 👋\n\n' +
                'Hẹn gặp lại bạn ở TpShop!';
        }

        if (lowerQuery.includes('bạn là ai') ||
            lowerQuery.includes('tên bạn') ||
            lowerQuery.includes('bạn tên gì') ||
            lowerQuery.includes('who are you')) {

            return 'Mình là trợ lý AI của TpShop! 🤖\n\n' +
                'Mình chuyên tư vấn về:\n' +
                '• Điện thoại (iPhone, Samsung, Xiaomi...)\n' +
                '• Laptop (MacBook, Dell, Asus...)\n\n' +
                'Mình có thể giúp bạn tìm kiếm, so sánh và đưa ra gợi ý phù hợp nhất!';
        }

        return 'Mình là trợ lý AI của TpShop. 😊\n\n' +
            'Bạn cần tìm điện thoại hay laptop không? ' +
            'Mình sẽ giúp bạn tìm sản phẩm phù hợp nhất!';
    }

    /**
     * 📦 CHUẨN BỊ CONTEXT CHO RAG
     */
    private prepareContextProducts(topVariants: any[]): any[] {
        return topVariants.map(item => ({
            id: item.product._id.toString(),
            name: item.product.name,
            description: item.product.description,
            variant: {
                storage: item.variant.storage,
                color: item.variant.color,
                price: item.variant.price,
                finalPrice: item.variant.finalPrice,
                discountPercent: item.variant.discountPercent,
                isOnSale: item.variant.isOnSale,
                stock: item.variant.stock
            },
            similarity: item.similarity
        }));
    }

    /**
     * 📝 TẠO PROMPT CHO RAG
     */
    private buildRAGPrompt(contextProducts: any[], userMessage: string): string {
        return `
Bạn là trợ lý AI chuyên nghiệp của TpShop (cửa hàng điện thoại & laptop).

=== DANH SÁCH SẢN PHẨM LIÊN QUAN ===
(Đã được tìm kiếm qua hệ thống AI vector search - chỉ hiển thị sản phẩm PHÙ HỢP NHẤT)

${JSON.stringify(contextProducts, null, 2)}

=== NHIỆM VỤ CỦA BẠN ===

1. **PHÂN TÍCH NHU CẦU:**
   - Đọc kỹ câu hỏi của khách hàng
   - Xác định tiêu chí quan trọng (giá, tính năng, thương hiệu...)

2. **CHỌN SẢN PHẨM PHÙ HỢP:**
   - Chọn 2-3 sản phẩm PHÙ HỢP NHẤT từ danh sách trên
   - CHỈ chọn từ danh sách đã cho (không tự bịa)
   - Ưu tiên sản phẩm có similarity score cao

3. **GIẢI THÍCH VÀ SO SÁNH:**
   - Giải thích TẠI SAO sản phẩm phù hợp
   - So sánh ưu nhược điểm
   - Đưa ra gợi ý cuối cùng

4. **ĐỊNH DẠNG TRẢ LỜI:**

🔍 **Phân tích nhu cầu:**
[Tóm tắt ngắn gọn nhu cầu của khách]

📱 **Sản phẩm đề xuất:**

🔹 **[Tên sản phẩm 1]**
   • Giá: [giá] VNĐ
   • Ưu điểm: [liệt kê 2-3 ưu điểm nổi bật]
   • Phù hợp: [giải thích tại sao phù hợp]

🔹 **[Tên sản phẩm 2]**
   • Giá: [giá] VNĐ
   • Ưu điểm: [liệt kê 2-3 ưu điểm nổi bật]
   • Phù hợp: [giải thích tại sao phù hợp]

💡 **Kết luận:**
[Gợi ý cuối cùng dựa trên nhu cầu]

=== YÊU CẦU FORMAT ===

Trả về JSON THUẦN theo format:
{
  "isProductQuery": true,
  "response": "[Nội dung tư vấn theo format trên]",
  "productIds": ["id1", "id2", "id3"]
}

=== QUY TẮC BẮT BUỘC ===

✅ CHỈ chọn sản phẩm từ danh sách đã cho
✅ CHỈ đề xuất 2-3 sản phẩm (không quá nhiều)
✅ productIds phải là ID THẬT từ danh sách
✅ Giải thích rõ ràng, dễ hiểu
✅ Trả về JSON THUẦN (không có \`\`\`json hay markdown)

❌ KHÔNG tự bịa sản phẩm không có trong danh sách
❌ KHÔNG đề xuất quá nhiều sản phẩm (gây loãng)
❌ KHÔNG trả về text thừa ngoài JSON

=== CÂU HỎI KHÁCH HÀNG ===
"${userMessage}"

=== HÃY TRẢ LỜI ===
`.trim();
    }

    /**
     * 🎁 TRÍCH XUẤT SẢN PHẨM ĐỀ XUẤT
     */
    private extractRecommendedProducts(productIds: any, topVariants: any[]): any[] {
        if (!productIds || !Array.isArray(productIds)) {
            return [];
        }

        const ids = productIds.map(id => String(id));

        return topVariants
            .filter(item => ids.includes(item.product._id.toString()))
            .map(item => ({
                _id: item.product._id,
                id: item.product._id.toString(),
                name: item.product.name,
                price: item.variant.price,
                finalPrice: item.variant.finalPrice,
                discountPercent: item.variant.discountPercent,
                isOnSale: item.variant.isOnSale,
                description: item.product.description,
                image: item.variant.imageUrls?.[0] || null,
                storage: item.variant.storage,
                color: item.variant.color,
                stock: item.variant.stock,
                categoryId: item.product.categoryId,
                subcategoryId: item.product.subcategoryId,
                similarity: item.similarity
            }));
    }

    // ========================================
    // 🛠️ UTILITY METHODS
    // ========================================

    /**
     * 🔄 GENERATE VỚI RETRY & FALLBACK
     */
    private async generateWithRetryAndFallback(prompt: string): Promise<string> {
        let lastError: any;

        for (const modelName of this.MODEL_CANDIDATES) {
            console.log(`\n🔄 Trying model: ${modelName}`);
            
            let delay = this.INITIAL_DELAY_MS;

            for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
                try {
                    console.log(`   Attempt ${attempt}/${this.MAX_RETRIES}...`);
                    
                    // ✅ Cú pháp mới: gọi qua this.genAI.models.generateContent
                    const result = await this.genAI.models.generateContent({
                        model: modelName,
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    });
                    
                    // ✅ FIX: result.text là getter, không phải hàm ()
                    const text = result.text;
                    
                    if (!text || typeof text !== 'string') {
                        throw new Error('Empty response text');
                    }
                    
                    console.log(`✅ SUCCESS with ${modelName}`);
                    return text;
                    
                } catch (error: any) {
                    lastError = error;
                    console.warn(`   ⚠️ Failed: ${error.message}`);

                    if (attempt < this.MAX_RETRIES) {
                        const jitter = Math.floor(Math.random() * 400);
                        await new Promise((r) => setTimeout(r, delay + jitter));
                        delay *= this.BACKOFF_FACTOR;
                    }
                }
            }
            console.log(`❌ Model ${modelName} failed after ${this.MAX_RETRIES} retries`);
        }

        console.error('❌ ALL MODELS FAILED!');
        throw lastError ?? new Error('Gemini generation failed after retries & fallbacks');
    }

    /**
     * 📄 PARSE JSON AN TOÀN
     */
    private safeParseJson(raw: string) {
        if (!raw) return null;

        let s = raw.replace(/```json\s*([\s\S]*?)\s*```/gi, '$1').trim();
        s = s.replace(/```([\s\S]*?)```/g, '$1').trim();

        const firstCurly = s.indexOf('{');
        const lastCurly = s.lastIndexOf('}');
        if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
            s = s.slice(firstCurly, lastCurly + 1).trim();
        }

        try {
            const obj = JSON.parse(s);

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
