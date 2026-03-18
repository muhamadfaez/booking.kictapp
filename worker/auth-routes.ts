import { Hono } from "hono";
import { sign } from 'hono/jwt';
import type { Env } from './core-utils';
import { ok, bad } from './core-utils';
import { UserEntity, AuditTrailEntity } from "./entities";
import type { User, AuditTrailEntry } from "@shared/types";
import { GoogleMailService, renderStandardEmail } from './mail';
import { recordSignIn } from './signin-tracker';


// Helper to generate a 6-digit numeric code
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

type OtpRecord = {
    code: string;
    expiresAt: number;
    attempts: number;
};

async function requireJwtSecret(env: Env): Promise<string> {
    if (!env.JWT_SECRET || env.JWT_SECRET.trim().length < 32) {
        throw new Error('JWT_SECRET is missing or too short');
    }
    return env.JWT_SECRET;
}

async function createAuthAudit(env: Env, input: Omit<AuditTrailEntry, 'id' | 'createdAt'> & { createdAt?: number }) {
    const entry: AuditTrailEntry = {
        id: `audit_${crypto.randomUUID()}`,
        createdAt: input.createdAt ?? Date.now(),
        ...input
    };
    await AuditTrailEntity.create(env, entry);
}

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
        const otpKey = `otp:${cleanEmail}`;
        let stored = false;
        for (let i = 0; i < 4; i++) {
            const current = await globalDO.getDoc<OtpRecord>(otpKey);
            const version = current?.v ?? 0;
            const result = await globalDO.casPut(otpKey, version, {
                code,
                expiresAt: Date.now() + OTP_TTL_MS,
                attempts: 0
            });
            if (result.ok) {
                stored = true;
                break;
            }
        }
        if (!stored) return bad(c, 'Failed to create OTP. Please retry.');

        // SEND EMAIL
        try {
            const mailer = new GoogleMailService(c.env);

            const subject = `Your Verification Code: ${code}`;
            const html = renderStandardEmail({
                eyebrow: 'One-Time Passcode',
                title: 'Verify Your Sign In',
                intro: 'Use the verification code below to continue signing in to the KICT Booking platform.',
                accent: '#4F46E5',
                callout: code,
                sections: [
                    { label: 'Expires In', value: '5 minutes' },
                    { label: 'Requested For', value: cleanEmail }
                ],
                footer: "If you didn't request this code, you can safely ignore this message."
            });

            await mailer.sendEmail(cleanEmail, subject, { html });
            console.log(`[AUTH] Email sent to ${cleanEmail}`);
        } catch (err: any) {
            console.error('[AUTH] Failed to send email:', err);
            // Fallback: keep OTP flow usable when mail provider is temporarily unavailable.
            // debugCode is returned only in this degraded path.
            return ok(c, {
                message: 'OTP generated, but email delivery is unavailable. Use temporary code.',
                debugCode: code
            });
        }

        await createAuthAudit(c.env, {
            actorUserId: `otp:${cleanEmail}`,
            actorEmail: cleanEmail,
            action: 'AUTH_OTP_REQUESTED',
            summary: `OTP requested for ${cleanEmail}`,
            targetType: 'AUTH',
            targetId: cleanEmail
        });

        return ok(c, { message: 'OTP sent' });
    });

    // 2. Verify OTP & Login
    app.post('/api/auth/otp/verify', async (c) => {
        const { email, code, name } = await c.req.json() as { email: string; code: string; name?: string };
        if (!email || !code) return bad(c, 'Missing email or code');

        const cleanEmail = email.toLowerCase().trim();

        // Verify Code
        const globalDO = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName('GlobalDurableObject'));
        const otpKey = `otp:${cleanEmail}`;
        const doc = await globalDO.getDoc<OtpRecord>(otpKey);

        if (!doc || !doc.data) return bad(c, 'Invalid or expired OTP request');

        const { code: storedCode, expiresAt, attempts } = doc.data;
        if (Date.now() > expiresAt) {
            await globalDO.del(otpKey);
            return bad(c, 'OTP expired');
        }
        if (attempts >= OTP_MAX_ATTEMPTS) {
            await globalDO.del(otpKey);
            return bad(c, 'Too many invalid attempts. Request a new code.');
        }
        if (storedCode !== code) {
            await globalDO.casPut(otpKey, doc.v, {
                code: storedCode,
                expiresAt,
                attempts: attempts + 1
            });
            return bad(c, 'Invalid OTP');
        }

        // Consume OTP
        await globalDO.del(otpKey);

        // Create/Update User
        const id = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

        const userEntity = new UserEntity(c.env, id);
        let userData = await userEntity.getState();

        if (!userData.id || userData.id !== id) {
            // New User
            const newUser: User = {
                id,
                email: cleanEmail,
                name: name || cleanEmail.split('@')[0],
                role: 'USER',
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`
            };
            await UserEntity.create(c.env, newUser);
            userData = newUser;
        } else if (!userData.avatar) {
            const generatedAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`;
            await userEntity.patch({ avatar: generatedAvatar });
            userData = {
                ...userData,
                avatar: generatedAvatar
            };
        }

        // Generate JWT
        const payload = {
            sub: userData.id,
            email: userData.email,
            role: userData.role,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
        };

        const jwtSecret = await requireJwtSecret(c.env);
        const token = await sign(payload, jwtSecret);

        try {
            await recordSignIn(c.env, {
                userId: userData.id,
                email: userData.email,
                name: userData.name,
                role: userData.role,
                method: 'OTP',
                signedInAt: Date.now()
            });
        } catch (err) {
            console.error('[AUTH] Failed to record OTP sign-in:', err);
        }

        await createAuthAudit(c.env, {
            actorUserId: userData.id,
            actorEmail: userData.email,
            actorRole: userData.role,
            action: 'AUTH_SIGNIN',
            summary: `${userData.email} signed in with OTP`,
            targetType: 'AUTH',
            targetId: userData.id,
            metadata: { method: 'OTP' }
        });

        return ok(c, { token, user: userData });
    });

    // 3. Google Login Exchange
    app.post('/api/auth/google', async (c) => {
        const { accessToken } = await c.req.json() as { accessToken?: string };
        if (!accessToken) return bad(c, 'Missing Google access token');

        const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!googleRes.ok) return bad(c, 'Invalid Google token');

        const googleUser = await googleRes.json() as {
            email?: string;
            name?: string;
            picture?: string;
            email_verified?: boolean | string;
        };
        if (!googleUser.email) return bad(c, 'Google account has no email');
        const emailVerified = googleUser.email_verified === true || googleUser.email_verified === 'true';
        if (!emailVerified) return bad(c, 'Google email is not verified');

        const cleanEmail = googleUser.email.toLowerCase().trim();
        const name = googleUser.name;
        const avatar = googleUser.picture;

        const id = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

        const userEntity = new UserEntity(c.env, id);
        let userData = await userEntity.getState();

        if (!userData.id || userData.id !== id) {
            const newUser: User = {
                id,
                email: cleanEmail,
                name: name || cleanEmail.split('@')[0],
                role: 'USER',
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

        const jwtSecret = await requireJwtSecret(c.env);
        const token = await sign(payload, jwtSecret);

        try {
            await recordSignIn(c.env, {
                userId: userData.id,
                email: userData.email,
                name: userData.name,
                role: userData.role,
                method: 'GOOGLE',
                signedInAt: Date.now()
            });
        } catch (err) {
            console.error('[AUTH] Failed to record Google sign-in:', err);
        }

        await createAuthAudit(c.env, {
            actorUserId: userData.id,
            actorEmail: userData.email,
            actorRole: userData.role,
            action: 'AUTH_SIGNIN',
            summary: `${userData.email} signed in with Google`,
            targetType: 'AUTH',
            targetId: userData.id,
            metadata: { method: 'GOOGLE' }
        });

        return ok(c, { token, user: userData });
    });
}
