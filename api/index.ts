// api/index.ts
import { createNestServer } from '../src/bootstrap';

let cached: any;

export default async function handler(req: any, res: any) {
    console.log('🔍 Vercel handler called:', req.url, req.method);
    
    // ✅ Xử lý path /api/*
    if (req.url.startsWith('/api/')) {
        req.url = req.url.replace('/api', '');
        console.log('🔄 Rewritten URL:', req.url);
    }
    
    if (!cached) {
        console.log('🚀 Creating NestJS server...');
        cached = await createNestServer();
        console.log('✅ NestJS server created');
    }
    
    return cached(req, res);
}
