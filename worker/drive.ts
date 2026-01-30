import { Env } from './core-utils';

export class GoogleDriveService {
    private env: Env;
    private token: string | null = null;
    private tokenExpiresAt: number = 0;

    constructor(env: Env) {
        this.env = env;
    }

    /**
     * Exchanges Refresh Token for Access Token
     */
    private async getAccessToken(): Promise<string> {
        if (this.token && Date.now() < this.tokenExpiresAt - 60000) {
            return this.token;
        }

        if (!this.env.GOOGLE_REFRESH_TOKEN || !this.env.GOOGLE_CLIENT_ID || !this.env.GOOGLE_CLIENT_SECRET) {
            throw new Error("Missing Google OAuth credentials in .dev.vars");
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
            throw new Error(`Auth failed: ${JSON.stringify(data)}`);
        }

        this.token = data.access_token;
        // Expires in usually 3600 seconds
        this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
        return this.token!;
    }

    async uploadFile(file: File, folderId?: string, customFilename?: string): Promise<{ id: string; webViewLink: string; webContentLink: string }> {
        const token = await this.getAccessToken();
        const targetFolder = folderId || this.env.GOOGLE_DRIVE_FOLDER_ID;

        const metadata = {
            name: customFilename || file.name,
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
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink",
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

        // Make file public (optional, but needed if users need to view it without login)
        // Note: With OAuth, files are usually private to the user unless shared.
        // We'll trust the user to manage permissions or we can add permission here.
        await this.makePublic(result.id, token);

        return result;
    }

    private async makePublic(fileId: string, token: string) {
        try {
            await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    role: 'reader',
                    type: 'anyone'
                })
            });
        } catch (e) {
            console.warn("Failed to make file public", e);
        }
    }
}
