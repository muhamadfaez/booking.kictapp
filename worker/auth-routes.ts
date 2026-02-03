import { Hono } from "hono";
import { sign } from 'hono/jwt';
import type { Env } from './core-utils';
import { ok, bad, notFound } from './core-utils';
import { UserEntity } from "./entities";
import type { User, UserRole } from "@shared/types";
import { GoogleMailService } from './mail';


// Helper to generate a 6-digit numeric code
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// Admin emails hardcoded for security bootstrap (same as frontend)
const ADMIN_EMAILS = ['muhamadfaez@iium.edu.my'];

export function authRoutes(app: Hono<{ Bindings: Env; Variables: { user: any } }>) {

    // 1. Request OTP
    app.post('/api/auth/otp/request', async (c) => {
        const { email } = await c.req.json() as { email: string };
        if (!email || !email.includes('@')) return bad(c, 'Invalid email');

        const cleanEmail = email.toLowerCase().trim();
        const code = generateCode();

        // Store in GlobalDurableObject with expiration (e.g., 5 minutes)
        // Key: otp:<email> -> { code, expiresAt }
        const globalDO = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('GlobalDurableObject'));
        await globalDO.casPut(`otp:${cleanEmail}`, 0, {
            code,
            expiresAt: Date.now() + 5 * 60 * 1000
        });

        // SEND EMAIL
        try {
            const mailer = new GoogleMailService(c.env);

            const subject = `Your Verification Code: ${code}`;
            const html = `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Sign in to IIUM Booking</h2>
                    <p>Your verification code is:</p>
                    <h1 style="font-size: 32px; letter-spacing: 5px; color: #4F46E5;">${code}</h1>
                    <p>This code will expire in 5 minutes.</p>
                    <p style="color: #666; font-size: 12px; margin-top: 30px;">If you didn't request this code, you can ignore this email.</p>
                </div>
            `;

            await mailer.sendEmail(cleanEmail, subject, { html });
            console.log(`[AUTH] Email sent to ${cleanEmail}`);
        } catch (err: any) {
            console.error('[AUTH] Failed to send email:', err);
            return bad(c, 'Failed to send verification email. Please contact support.');
        }

        return ok(c, { message: 'OTP sent' });
    });

    // 2. Verify OTP & Login
    app.post('/api/auth/otp/verify', async (c) => {
        const { email, code, name } = await c.req.json() as { email: string; code: string; name?: string };
        if (!email || !code) return bad(c, 'Missing email or code');

        const cleanEmail = email.toLowerCase().trim();

        // Verify Code
        const globalDO = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('GlobalDurableObject'));
        const doc = await globalDO.getDoc(`otp:${cleanEmail}`) as any;

        if (!doc || !doc.data) return bad(c, 'Invalid or expired OTP request');

        const { code: storedCode, expiresAt } = doc.data;
        if (Date.now() > expiresAt) return bad(c, 'OTP expired');
        if (storedCode !== code) return bad(c, 'Invalid OTP');

        // Consume OTP
        await globalDO.del(`otp:${cleanEmail}`);

        // Create/Update User
        const id = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const role: UserRole = ADMIN_EMAILS.includes(cleanEmail) ? 'ADMIN' : 'USER';

        const userEntity = new UserEntity(c.env, id);
        let userData = await userEntity.getState();

        if (!userData.id || userData.id !== id) {
            // New User
            const newUser: User = {
                id,
                email: cleanEmail,
                name: name || cleanEmail.split('@')[0],
                role,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`
            };
            await UserEntity.create(c.env, newUser);
            userData = newUser;
        } else {
            if (userData.role !== role) {
                await userEntity.patch({ role });
                userData.role = role;
            }
        }

        // Generate JWT
        const payload = {
            sub: userData.id,
            email: userData.email,
            role: userData.role,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
        };

        const token = await sign(payload, c.env.JWT_SECRET || 'dev-secret-fallback');

        return ok(c, { token, user: userData });
    });

    // 3. Google Login Exchange
    app.post('/api/auth/google', async (c) => {
        const { email, name, avatar } = await c.req.json() as { email: string; name: string; avatar?: string };
        if (!email) return bad(c, 'Missing email');
        const cleanEmail = email.toLowerCase().trim();

        const id = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const role: UserRole = ADMIN_EMAILS.includes(cleanEmail) ? 'ADMIN' : 'USER';

        const userEntity = new UserEntity(c.env, id);
        let userData = await userEntity.getState();

        if (!userData.id || userData.id !== id) {
            const newUser: User = {
                id,
                email: cleanEmail,
                name: name || cleanEmail.split('@')[0],
                role,
                avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`
            };
            await UserEntity.create(c.env, newUser);
            userData = newUser;
        } else {
            // Update existing user info if changed
            const updates: any = {};
            if (name && userData.name !== name) updates.name = name;
            if (avatar && userData.avatar !== avatar) updates.avatar = avatar;

            if (Object.keys(updates).length > 0) {
                await userEntity.patch(updates);
                userData = { ...userData, ...updates };
            }
        }

        const payload = {
            sub: userData.id,
            email: userData.email,
            role: userData.role,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
        };

        const token = await sign(payload, c.env.JWT_SECRET || 'dev-secret-fallback');

        return ok(c, { token, user: userData });
    });
}
