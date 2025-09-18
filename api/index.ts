import { createNestServer } from '../src/bootstrap';

let cached: any;

export default async function handler(req: any, res: any) {
    console.log('🔍 Original URL:', req.url, req.method);
    console.log('🔍 Query:', req.query);

    // ✅ Lấy full URL từ request
    let path = req.url;

    // ✅ Xử lý /api prefix
    if (path.startsWith('/api/')) {
        path = path.replace('/api/', '/');
        console.log('🔄 Rewritten /api/* to:', path);
    } else if (path === '/api') {
        path = '/';
        console.log('🔄 Rewritten /api to:', path);
    }

    // ✅ Update request URL
    req.url = path;

    if (!cached) {
        console.log('🚀 Creating NestJS server...');
        try {
            cached = await createNestServer();
            console.log('✅ NestJS server created');
        } catch (error) {
            console.error('❌ Error creating server:', error);
            return res.status(500).json({ error: 'Server creation failed' });
        }
    }

    console.log('📤 Final URL sent to NestJS:', req.method, req.url);

    try {
        return cached(req, res);
    } catch (error) {
        console.error('❌ Request handling error:', error);
        return res.status(500).json({ error: 'Request failed' });
    }
}