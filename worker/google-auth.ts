import { Env } from './core-utils';

export class GoogleAuth {
    private env: Env;
    private token: string | null = null;
    private tokenExpiresAt: number = 0;

    // Scopes needed for our app
    // We add both Drive and Gmail scopes here so the token works for both
    static readonly SCOPES = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/gmail.send'
    ];

    constructor(env: Env) {
        this.env = env;
    }

    /**
     * Exchanges Refresh Token for Access Token
     */
    async getAccessToken(): Promise<string> {
        if (this.token && Date.now() < this.tokenExpiresAt - 60000) {
            return this.token;
        }

        if (!this.env.GOOGLE_REFRESH_TOKEN || !this.env.GOOGLE_CLIENT_ID || !this.env.GOOGLE_CLIENT_SECRET) {
            // Log missing config helps debugging
            console.error("Missing Google Config:", {
                hasRefreshToken: !!this.env.GOOGLE_REFRESH_TOKEN,
                hasClientId: !!this.env.GOOGLE_CLIENT_ID,
                hasClientSecret: !!this.env.GOOGLE_CLIENT_SECRET
            });
            throw new Error("Missing Google OAuth credentials in .dev.vars or env");
        }

        const params = new URLSearchParams({
            client_id: this.env.GOOGLE_CLIENT_ID,
            client_secret: this.env.GOOGLE_CLIENT_SECRET,
            refresh_token: this.env.GOOGLE_REFRESH_TOKEN,
            grant_type: "refresh_token",
        });

        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params,
        });

        const data = await response.json() as any;
        if (!response.ok) {
            console.error("Google Token Exchange Failed:", data);
            throw new Error(`Auth failed: ${JSON.stringify(data)}`);
        }

        this.token = data.access_token;
        // Expires in usually 3600 seconds
        this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
        return this.token!;
    }
}
