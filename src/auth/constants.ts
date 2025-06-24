export const jwtConstants = {
    secret: process.env.JWT_SECRET || 'tpshop-secret-key-change-in-production',
    expiresIn: '24h',
};