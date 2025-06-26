export const jwtConstants = {
    secret: process.env.JWT_SECRET || 'tpshop-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRATION || '1d',
};