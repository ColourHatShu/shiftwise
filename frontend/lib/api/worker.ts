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
