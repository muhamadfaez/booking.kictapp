import { Env } from './core-utils';
import { GoogleAuth } from './google-auth';

type EmailLayoutOptions = {
    eyebrow?: string;
    title: string;
    intro: string;
    accent?: string;
    sections?: Array<{ label: string; value: string }>;
    callout?: string;
    footer?: string;
};

const DEFAULT_ACCENT = '#0f8f6f';

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export function renderStandardEmail(options: EmailLayoutOptions) {
    const accent = options.accent || DEFAULT_ACCENT;
    const sections = (options.sections || [])
        .map(
            (section) => `
                <tr>
                    <td style="padding: 0 0 14px 0;">
                        <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280;">${escapeHtml(section.label)}</div>
                        <div style="margin-top: 4px; font-size: 15px; line-height: 1.5; color: #111827; font-weight: 600;">${escapeHtml(section.value)}</div>
                    </td>
                </tr>
            `
        )
        .join('');

    const callout = options.callout
        ? `<div style="margin-top: 20px; border-radius: 18px; background: ${accent}; color: #ffffff; padding: 18px 20px; font-size: 22px; font-weight: 700; letter-spacing: 0.04em; text-align: center;">${escapeHtml(options.callout)}</div>`
        : '';

    return `
        <div style="margin: 0; padding: 24px 0; background: #f3f7f5; font-family: Arial, sans-serif; color: #111827;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                <tr>
                    <td align="center">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 0 16px;">
                                    <div style="overflow: hidden; border-radius: 28px; background: #ffffff; border: 1px solid #dbe5e0; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);">
                                        <div style="padding: 28px 32px; background: linear-gradient(135deg, ${accent} 0%, #0b2f27 100%); color: #ffffff;">
                                            <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.8;">${escapeHtml(options.eyebrow || 'KICT Booking')}</div>
                                            <div style="margin-top: 14px; font-size: 30px; line-height: 1.15; font-weight: 800;">${escapeHtml(options.title)}</div>
                                            <div style="margin-top: 10px; font-size: 15px; line-height: 1.7; opacity: 0.92;">${escapeHtml(options.intro)}</div>
                                        </div>
                                        <div style="padding: 28px 32px;">
                                            ${callout}
                                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 22px; border-collapse: collapse;">
                                                ${sections}
                                            </table>
                                            <div style="margin-top: 22px; font-size: 13px; line-height: 1.7; color: #6b7280;">
                                                ${escapeHtml(options.footer || 'Please keep this message for your records.')}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </div>
    `;
}

export class GoogleMailService {
    private auth: GoogleAuth;

    constructor(env: Env) {
        this.auth = new GoogleAuth(env);
    }

    async sendEmail(to: string, subject: string, bodyObj: { text?: string; html?: string; }) {
        const token = await this.auth.getAccessToken();

        // Construct raw email
        // Headers + Body
        const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

        // Simple multipart construction if HTML and Text are present, 
        // but for OTP a simple text/html body is often enough. 
        // We will use a simple Content-Type: text/html for now for simplicity.

        const messageParts = [
            `To: ${to}`,
            `Subject: ${utf8Subject}`,
            "MIME-Version: 1.0",
            "Content-Type: text/html; charset=utf-8",
            "",
            bodyObj.html || bodyObj.text || ""
        ];

        const rawMessage = messageParts.join("\n");
        const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                raw: encodedMessage
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gmail Send Error:', errorData);
            throw new Error(`Failed to send email: ${response.statusText}`);
        }

        return await response.json();
    }
}
