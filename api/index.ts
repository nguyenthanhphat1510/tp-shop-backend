import { createNestServer } from '../src/bootstrap';

let cached: any;

export default async function handler(req: any, res: any) {
    console.log('🔍 Original URL:', req.url, req.method);
    
    // ✅ Xử lý /api prefix
    if (req.url.startsWith('/api/')) {
        req.url = req.url.replace('/api/', '/');
        console.log('🔄 Rewritten /api/* to:', req.url);
    } else if (req.url === '/api') {
        req.url = '/';
        console.log('🔄 Rewritten /api to:', req.url);
    }

    if (!cached) {
        console.log('🚀 Creating NestJS server...');
        cached = await createNestServer();
        console.log('✅ NestJS server created');
    }

    console.log('📤 Final URL sent to NestJS:', req.method, req.url);
    
    // ✅ Thêm headers để debug
    res.setHeader('X-Debug-URL', req.url);
    res.setHeader('X-Debug-Method', req.method);
    
    // ✅ Đảm bảo return đúng cách
    try {
        await cached(req, res);
    } catch (error) {
        console.error('❌ Handler error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}