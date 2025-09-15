import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(private authService: AuthService) {
        // FIX: Add logging để debug
        console.log('🔍 Google Strategy Config:', {
            clientID: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...',
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
            hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
        });

        super({
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
            scope: ['email', 'profile'],
        });
    }

    async validate(
        accessToken: string, 
        refreshToken: string, 
        profile: any, 
        done: VerifyCallback
    ): Promise<any> {
        try {
            console.log('🔍 Google profile received:', {
                id: profile.id,
                email: profile.emails?.[0]?.value,
                name: profile.displayName
            });
            
            const { name, emails, photos, id } = profile;
            
            if (!emails || emails.length === 0) {
                throw new Error('No email found in Google profile');
            }

            const googleUser = {
                email: emails[0].value,
                firstName: name?.givenName || '',
                lastName: name?.familyName || '',
                picture: photos?.[0]?.value || null,
                googleId: id,
            };

            console.log('📝 Processed Google user:', googleUser);

            const validatedUser = await this.authService.validateGoogleUser(googleUser);
            done(null, validatedUser);
        } catch (error) {
            console.error('❌ Google strategy error:', error);
            done(error, false);
        }
    }
}