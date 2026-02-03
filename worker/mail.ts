import { Env } from './core-utils';
import { GoogleAuth } from './google-auth';

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
