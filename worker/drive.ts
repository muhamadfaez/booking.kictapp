import { Env } from './core-utils';
import { GoogleAuth } from './google-auth';

export class GoogleDriveService {
    private env: Env;
    private auth: GoogleAuth;

    constructor(env: Env) {
        this.env = env;
        this.auth = new GoogleAuth(env);
    }

    private async getAccessToken(): Promise<string> {
        return this.auth.getAccessToken();
    }

    async uploadFile(file: File, folderId?: string, customFilename?: string): Promise<{ id: string; webViewLink: string; webContentLink: string; thumbnailLink: string }> {
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
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink,thumbnailLink",
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

    async getFileStream(fileId: string): Promise<{ stream: ReadableStream; contentType: string }> {
        const token = await this.getAccessToken();

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch file stream: ${response.statusText}`);
        }

        return {
            stream: response.body!,
            contentType: response.headers.get('Content-Type') || 'application/octet-stream'
        };
    }

    async deleteFile(fileId: string): Promise<void> {
        const token = await this.getAccessToken();
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`Failed to delete file ${fileId}: ${error}`);
            // We don't throw here to avoid blocking the main flow if deletion fails
        }
    }
}
