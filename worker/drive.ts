import { Env } from './core-utils';

export class StorageService {
    private env: Env;

    constructor(env: Env) {
        this.env = env;
    }

    /**
     * Uploads a file to Cloudflare R2
     * Returns a public URL for the file (served via worker)
     */
    async uploadFile(file: File, folderId?: string): Promise<{ id: string; webViewLink: string }> {
        // Generate a unique key
        const key = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;

        // Upload to R2
        await this.env.BUCKET.put(key, file.stream(), {
            httpMetadata: {
                contentType: file.type,
            }
        });

        // Construct the "public" URL (served by our worker)
        // Since we don't have the full URL context, we'll return a relative path or absolute path if we knew the domain.
        // For now, we'll return a relative path `/api/files/{key}` which the frontend can use.
        const webViewLink = `/api/files/${key}`;

        return {
            id: key,
            webViewLink: webViewLink
        };
    }
}
