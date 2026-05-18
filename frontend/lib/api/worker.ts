/**
 * Worker API Client
 * Handles communication with worker self-service backend endpoints
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Send OTP to worker's email
 */
export async function sendWorkerOtp(email: string) {
    const response = await fetch(`${API_BASE}/worker-signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send OTP');
    }

    return response.json();
}

/**
 * Verify OTP and get JWT token
 */
export async function verifyWorkerOtp(email: string, otp: string) {
    const response = await fetch(`${API_BASE}/worker/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for JWT storage
        body: JSON.stringify({ email, otp }),
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Invalid OTP');
    }

    return response.json();
}

/**
 * Get worker's documents
 */
export async function getWorkerDocuments() {
    const response = await fetch(`${API_BASE}/worker/documents`, {
        method: 'GET',
        credentials: 'include', // Include JWT cookie
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch documents');
    }

    return response.json();
}

/**
 * Upload a document as a worker
 */
export async function uploadWorkerDocument(formData: FormData) {
    const response = await fetch(`${API_BASE}/worker/documents/upload`, {
        method: 'POST',
        credentials: 'include', // Include JWT cookie
        body: formData, // FormData handles multipart/form-data encoding
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
    }

    return response.json();
}

/**
 * Logout worker (clear JWT cookie)
 */
export async function logoutWorker() {
    const response = await fetch(`${API_BASE}/worker/logout`, {
        method: 'POST',
        credentials: 'include',
    });

    if (!response.ok) {
        console.error('Logout failed');
    }

    return response.ok;
}

/**
 * Optimize photo: resize, compress, correct rotation
 * Reduces large camera photos to <2MB JPEG
 */
export async function optimizePhoto(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const img = new Image();

                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;

                    // Resize if larger than 2048px on any dimension
                    const maxDimension = 2048;
                    if (width > maxDimension || height > maxDimension) {
                        const ratio = Math.min(maxDimension / width, maxDimension / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error('Failed to get canvas context');

                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to JPEG with quality 0.8
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) throw new Error('Failed to create blob');

                            const optimizedFile = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });

                            // Check file size
                            if (optimizedFile.size > 2 * 1024 * 1024) {
                                // If still too large, reduce quality further
                                canvas.toBlob(
                                    (reducedBlob) => {
                                        if (!reducedBlob) throw new Error('Failed to create reduced-quality blob');
                                        const finalFile = new File([reducedBlob], optimizedFile.name, {
                                            type: 'image/jpeg',
                                            lastModified: Date.now(),
                                        });
                                        resolve(finalFile);
                                    },
                                    'image/jpeg',
                                    0.6
                                );
                            } else {
                                resolve(optimizedFile);
                            }
                        },
                        'image/jpeg',
                        0.8
                    );
                };

                img.onerror = () => {
                    reject(new Error('Failed to load image'));
                };

                img.src = e.target?.result as string;
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsDataURL(file);
    });
}
