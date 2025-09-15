// Tạo file test trong backend root
// filepath: d:\NHT\Code\DA3\TpShop\backend\test-env.js
require('dotenv').config();

console.log('Environment Variables Test:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Loaded ✅' : 'Missing ❌');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Loaded ✅' : 'Missing ❌');
console.log('GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL || 'Missing ❌');
console.log('DATABASE_URL:', process.env.DATABASE_URL || 'Missing ❌');