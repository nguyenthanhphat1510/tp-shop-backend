import { createNestServer } from '../src/bootstrap';

let cached: any;

export default async function handler(req: any, res: any) {
    console.log('🔍 Incoming Request:', {
        method: req.method,
        url: req.url,
        originalUrl: req.originalUrl
    });

    // ✅ Không cần rewrite URL nữa, để NestJS xử lý trực tiếp
    // NestJS sẽ tự động handle với global prefix 'api'

    if (!cached) {
        console.log('🚀 Creating NestJS server...');
        try {
            cached = await createNestServer();
            console.log('✅ NestJS server created successfully');
        } catch (error) {
            console.error('❌ Failed to create NestJS server:', error);
            return res.status(500).json({ 
                error: 'Failed to initialize server',
                details: error.message 
            });
        }
    }

    console.log('📤 Processing request...');
    
    try {
        // ✅ Set CORS headers
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
        res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

        // ✅ Handle OPTIONS request
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        await cached(req, res);
        console.log('✅ Request processed successfully');
    } catch (error) {
        console.error('❌ Handler error:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Internal Server Error',
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
}