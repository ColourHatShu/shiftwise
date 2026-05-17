/**
 * Encryption Round-Trip Integration Tests
 *
 * Tests CBC backward compatibility and GCM authenticated encryption
 * across full document upload/download cycle.
 */

const { encryptFile, encryptFileGCM, decryptFileAuto } = require('../../lib/encryption');

jest.mock('../../lib/prisma');

describe('Encryption Round-Trip (CBC and GCM)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.DOCUMENT_ENCRYPTION_KEY = '0'.repeat(64);
    });

    describe('CBC Backward Compatibility', () => {
        it('should decrypt existing CBC-encrypted documents', () => {
            // Simulate a pre-existing CBC-encrypted document
            const originalContent = Buffer.from('Existing document content');
            const encrypted = encryptFile(originalContent);

            // Document would have been stored with encryptionAlgorithm: 'aes-256-cbc'
            // (or no field, defaulting to CBC)
            const algorithm = 'aes-256-cbc';

            // Download endpoint calls decryptFileAuto with the algorithm
            const decrypted = decryptFileAuto(encrypted, algorithm);
            expect(decrypted.toString()).toBe('Existing document content');
        });

        it('should decrypt old docs that default to CBC', () => {
            // Some old docs might not have encryptionAlgorithm field set
            const originalContent = Buffer.from('Old doc');
            const encrypted = encryptFile(originalContent);

            // Download endpoint defaults to CBC if algorithm is null/undefined
            const algorithm = null || 'aes-256-cbc';
            const decrypted = decryptFileAuto(encrypted, algorithm);
            expect(decrypted.toString()).toBe('Old doc');
        });
    });

    describe('GCM New Uploads', () => {
        it('should encrypt and decrypt new GCM documents', () => {
            const newContent = Buffer.from('Brand new document');
            const encrypted = encryptFileGCM(newContent);

            // New documents are tagged with encryptionAlgorithm: 'aes-256-gcm'
            const algorithm = 'aes-256-gcm';

            // Download endpoint decrypts with GCM
            const decrypted = decryptFileAuto(encrypted, algorithm);
            expect(decrypted.toString()).toBe('Brand new document');
        });

        it('should detect tampering in GCM documents', () => {
            const content = Buffer.from('Sensitive data');
            let encrypted = encryptFileGCM(content);

            // Simulate tampering (flip a bit in the ciphertext)
            const tamperIndex = 32; // After IV and tag
            if (tamperIndex < encrypted.length) {
                encrypted[tamperIndex] ^= 0xFF;
            }

            const algorithm = 'aes-256-gcm';

            // Decryption should detect tampering
            expect(() => decryptFileAuto(encrypted, algorithm)).toThrow();
        });
    });

    describe('Mixed CBC and GCM in Same Agency', () => {
        it('should handle mix of old CBC and new GCM docs in one agency', () => {
            const oldDoc = Buffer.from('Old compliance certificate');
            const newDoc = Buffer.from('New compliance certificate');

            const oldEncrypted = encryptFile(oldDoc);
            const newEncrypted = encryptFileGCM(newDoc);

            // Both downloads work with their respective algorithms
            const oldDecrypted = decryptFileAuto(oldEncrypted, 'aes-256-cbc');
            const newDecrypted = decryptFileAuto(newEncrypted, 'aes-256-gcm');

            expect(oldDecrypted.toString()).toBe('Old compliance certificate');
            expect(newDecrypted.toString()).toBe('New compliance certificate');
        });

        it('should fail if wrong algorithm used for GCM document', () => {
            const content = Buffer.from('GCM content');
            const encrypted = encryptFileGCM(content);

            // Wrong algorithm: user somehow has CBC but document is GCM
            // (or server bug returns wrong algorithm)
            expect(() => {
                decryptFileAuto(encrypted, 'aes-256-cbc');
            }).toThrow();
        });

        it('should fail if wrong algorithm used for CBC document', () => {
            const content = Buffer.from('CBC content');
            const encrypted = encryptFile(content);

            // Wrong algorithm: document marked as GCM but data is CBC
            expect(() => {
                decryptFileAuto(encrypted, 'aes-256-gcm');
            }).toThrow();
        });
    });

    describe('Structured Error Logging for GCM Failures', () => {
        it('should throw error with GCM auth failure code on tampering', () => {
            const content = Buffer.from('Sensitive');
            let encrypted = encryptFileGCM(content);

            // Tamper with the ciphertext (after IV and auth tag)
            const tamperIndex = 32;
            if (tamperIndex < encrypted.length) {
                encrypted[tamperIndex] ^= 0xFF;
            }

            try {
                decryptFileAuto(encrypted, 'aes-256-gcm');
                fail('Expected error to be thrown');
            } catch (err) {
                // Error should have a code property indicating GCM auth failure
                expect(err.code).toBeDefined();
                expect(['GCM_AUTH_FAIL', 'GCM_DECRYPT_ERROR']).toContain(err.code);
            }
        });
    });
});
