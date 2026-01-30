
/**
 * Compresses an image file to ensure it is below the target size (default 1MB).
 * Uses HTMLCanvasElement to resize and compress.
 */
export async function compressImage(file: File, maxSizeMB: number = 1, maxWidth: number = 1920): Promise<File> {
    // If already small enough and is JPEG, return as is. 
    // If it's PNG/WebP but small, we might still want to convert to JPG to ensure consistency, 
    // but for now let's only compress if completely necessary or if we want to standardize to JPG.
    // To ensure consistency (and fix the "corrupt" issue where PNG extension has JPG content), 
    // we will ALWAYS compress/convert if it's not a JPG or if it's too big.

    const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
    if (file.size <= maxSizeMB * 1024 * 1024 && isJpeg) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;

        img.onload = () => {
            URL.revokeObjectURL(url);

            let width = img.width;
            let height = img.height;

            // Resize if too large
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
            }

            // Fill with white background for JPEGs (handles transparency from PNGs)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);

            ctx.drawImage(img, 0, 0, width, height);

            // Determine output quality
            const quality = 0.8;

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error("Compression failed"));
                        return;
                    }

                    // Force .jpg extension
                    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                    const newFileName = `${fileNameWithoutExt}.jpg`;

                    // Create new File object
                    const compressedFile = new File([blob], newFileName, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });

                    resolve(compressedFile);
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };
    });
}
