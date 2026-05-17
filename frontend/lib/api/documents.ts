/**
 * Document API helpers
 *
 * Provides authenticated functions for document operations.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Download a document by ID.
 * Fetches the document via the authenticated endpoint with the user's JWT token.
 * Automatically extracts the filename from Content-Disposition header and triggers download.
 *
 * @param {string} documentId - The document ID to download
 * @param {Function} getToken - Clerk's getToken function from useAuth hook
 * @throws {Error} If the fetch fails or getToken fails
 */
export async function downloadDocument(documentId: string, getToken: () => Promise<string | null>): Promise<void> {
    try {
        // Get the user's JWT token from Clerk
        const token = await getToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        // Fetch the document from the authenticated download endpoint
        const response = await fetch(`${API_URL}/api/documents/${documentId}/download`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Document not found or access denied');
            }
            if (response.status === 401) {
                throw new Error('Session expired. Please log in again.');
            }
            throw new Error('Failed to download document');
        }

        // Read the response as a Blob
        const blob = await response.blob();

        // Extract filename from Content-Disposition header if available
        let fileName = `document-${documentId}`;
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition) {
            // Parse: attachment; filename="original.pdf"
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch[1]) {
                fileName = decodeURIComponent(filenameMatch[1]);
            }
        }

        // Create a temporary URL for the blob
        const url = URL.createObjectURL(blob);

        try {
            // Create a temporary anchor element and trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } finally {
            // Clean up the object URL to free memory
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Error downloading document:', error);
        throw error;
    }
}
