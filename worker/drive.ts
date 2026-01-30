import { Env } from './core-utils';

/**
 * Google Drive Service for Cloudflare Workers
 * Handles JWT generation and file uploads using standard Web APIs.
 */
export class GoogleDriveService {
    private env: Env;
    private token: string | null = null;
    private tokenExpiresAt: number = 0;

    constructor(env: Env) {
        this.env = env;
    }

    /**
     * Generates a signed JWT for Google Service Account Auth
     */
    private async getAccessToken(): Promise<string> {
        // Check if cached token is valid (minus 1 min buffer)
        if (this.token && Date.now() < this.tokenExpiresAt - 60000) {
            return this.token;
        }

        if (!this.env.GOOGLE_SERVICE_ACCOUNT) {
            throw new Error("Missing GOOGLE_SERVICE_ACCOUNT env var");
        }

        let credentials;
        try {
            credentials = JSON.parse(this.env.GOOGLE_SERVICE_ACCOUNT);
        } catch (e) {
            throw new Error("Invalid JSON in GOOGLE_SERVICE_ACCOUNT");
        }

        const header = { alg: "RS256", typ: "JWT" };
        const now = Math.floor(Date.now() / 1000);
        const claim = {
            iss: credentials.client_email,
            scope: "https://www.googleapis.com/auth/drive.file",
            aud: "https://oauth2.googleapis.com/token",
            exp: now + 3600,
            iat: now,
        };

        const encodedHeader = this.base64url(JSON.stringify(header));
        const encodedClaim = this.base64url(JSON.stringify(claim));
        const unsignedToken = `${encodedHeader}.${encodedClaim}`;

        const signature = await this.sign(unsignedToken, credentials.private_key);
        const jwt = `${unsignedToken}.${signature}`;

        // Exchange JWT for Access Token
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: jwt,
            }),
        });

        const data = await response.json() as any;
        if (!response.ok) {
            throw new Error(`Auth failed: ${JSON.stringify(data)}`);
        }

        this.token = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
        return this.token!;
    }

    /**
     * Uploads a file to Google Drive
     */
    async uploadFile(file: File, folderId?: string): Promise<{ id: string; webViewLink: string }> {
        const token = await this.getAccessToken();
        const targetFolder = folderId || this.env.GOOGLE_DRIVE_FOLDER_ID;

        // Metadata + File Upload (Multipart)
        const metadata = {
            name: file.name,
            mimeType: file.type,
            parents: targetFolder ? [targetFolder] : [],
        };

        const form = new FormData();
        form.append(
            "metadata",
            new Blob([JSON.stringify(metadata)], { type: "application/json" })
        );
        form.append("file", file);

        const match = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
            {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            }
        );

        const result = await match.json() as any;
        if (!match.ok) {
            throw new Error(`Upload failed: ${JSON.stringify(result)}`);
        }

        // Make file readable by anyone with the link (Optional, based on requirements)
        // await this.makePublic(result.id, token);

        return result;
    }

    /**
     * Helper: Base64URL Encode
     */
    private base64url(str: string): string {
        return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }

    /**
     * Helper: Sign with RS256
     */
    private async sign(data: string, privateKeyPem: string): Promise<string> {
        // Convert PEM to binary
        const pemHeader = "-----BEGIN PRIVATE KEY-----";
        const pemFooter = "-----END PRIVATE KEY-----";
        const pemContents = privateKeyPem
            .substring(
                privateKeyPem.indexOf(pemHeader) + pemHeader.length,
                privateKeyPem.indexOf(pemFooter)
            )
            .replace(/\s/g, "");

        const binaryDerString = atob(pemContents);
        const binaryDer = new Uint8Array(binaryDerString.length);
        for (let i = 0; i < binaryDerString.length; i++) {
            binaryDer[i] = binaryDerString.charCodeAt(i);
        }

        const key = await crypto.subtle.importKey(
            "pkcs8",
            binaryDer.buffer,
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const signature = await crypto.subtle.sign(
            "RSASSA-PKCS1-v1_5",
            key,
            new TextEncoder().encode(data)
        );

        return this.base64url(String.fromCharCode(...new Uint8Array(signature)));
    }
}
