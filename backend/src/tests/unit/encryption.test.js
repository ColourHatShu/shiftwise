/**
 * Unit tests for encryption module
 *
 * Tests CBC (legacy) and GCM (new authenticated) encryption/decryption.
 */

const {
    encryptFile,
    decryptFile,
    encryptFileGCM,
    decryptFileGCM,
    decryptFileAuto,
    GCM_IV_LENGTH,
    GCM_TAG_LENGTH
} = require('../../lib/encryption');

jest.mock('../../lib/prisma');

describe('Encryption Module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.DOCUMENT_ENCRYPTION_KEY = '0'.repeat(64); // 32 bytes = 64 hex chars
    });

    describe('CBC (AES-256-CBC)', () => {
        it('should encrypt and decrypt a buffer correctly', () => {
            const plaintext = Buffer.from('Hello, World!');
            const encrypted = encryptFile(plaintext);

            // Encrypted should be longer (IV + ciphertext)
            expect(encrypted.length).toBeGreaterThan(plaintext.length);

            const decrypted = decryptFile(encrypted);
            expect(decrypted.toString()).toBe('Hello, World!');
        });

        it('should produce different ciphertexts for the same plaintext (random IV)', () => {
            const plaintext = Buffer.from('Same content');
            const encrypted1 = encryptFile(plaintext);
            const encrypted2 = encryptFile(plaintext);

            // Due to random IV, ciphertexts should be different
            expect(encrypted1).not.toEqual(encrypted2);
        });

        it('should fail to decrypt with wrong key', () => {
            const plaintext = Buffer.from('Secret');
            const encrypted = encryptFile(plaintext);

            // Change the key
            process.env.DOCUMENT_ENCRYPTION_KEY = '1'.repeat(64);

            // Decryption should fail or produce garbage
            expect(() => decryptFile(encrypted)).toThrow();
        });
    });

    describe('GCM (AES-256-GCM)', () => {
        it('should encrypt and decrypt a buffer correctly', () => {
            const plaintext = Buffer.from('Sensitive data');
            const encrypted = encryptFileGCM(plaintext);

            // Layout: IV(12) | authTag(16) | ciphertext
            const minimumSize = GCM_IV_LENGTH + GCM_TAG_LENGTH;
            expect(encrypted.length).toBeGreaterThanOrEqual(minimumSize);

            const decrypted = decryptFileGCM(encrypted);
            expect(decrypted.toString()).toBe('Sensitive data');
        });

        it('should produce different ciphertexts for the same plaintext (random IV)', () => {
            const plaintext = Buffer.from('Same content');
            const encrypted1 = encryptFileGCM(plaintext);
            const encrypted2 = encryptFileGCM(plaintext);

            // Due to random IV, ciphertexts should be different
            expect(encrypted1).not.toEqual(encrypted2);
        });

        it('should fail when ciphertext is tampered', () => {
            const plaintext = Buffer.from('Original');
            let encrypted = encryptFileGCM(plaintext);

            // Tamper with the ciphertext (flip a bit after authTag)
            const tamperIndex = GCM_IV_LENGTH + GCM_TAG_LENGTH + 5;
            if (tamperIndex < encrypted.length) {
                encrypted[tamperIndex] ^= 0xFF;
            }

            // Decryption should throw (either GCM_AUTH_FAIL or GCM_DECRYPT_ERROR)
            try {
                decryptFileGCM(encrypted);
                fail('Expected GCM decryption to fail but did not throw');
            } catch (err) {
                expect(['GCM_AUTH_FAIL', 'GCM_DECRYPT_ERROR']).toContain(err.code);
            }
        });

        it('should fail when authTag is tampered', () => {
            const plaintext = Buffer.from('Data');
            let encrypted = encryptFileGCM(plaintext);

            // Tamper with the auth tag (within the second 16 bytes)
            encrypted[GCM_IV_LENGTH + 2] ^= 0xFF;

            // Decryption should fail
            expect(() => decryptFileGCM(encrypted)).toThrow();
        });

        it('should fail with wrong key', () => {
            const plaintext = Buffer.from('Secret');
            const encrypted = encryptFileGCM(plaintext);

            // Change the key
            process.env.DOCUMENT_ENCRYPTION_KEY = '1'.repeat(64);

            // Decryption should fail (auth tag won't match)
            expect(() => decryptFileGCM(encrypted)).toThrow();
        });
    });

    describe('decryptFileAuto', () => {
        it('should decrypt CBC data when algorithm is aes-256-cbc', () => {
            const plaintext = Buffer.from('CBC data');
            const encrypted = encryptFile(plaintext);

            const decrypted = decryptFileAuto(encrypted, 'aes-256-cbc');
            expect(decrypted.toString()).toBe('CBC data');
        });

        it('should decrypt GCM data when algorithm is aes-256-gcm', () => {
            const plaintext = Buffer.from('GCM data');
            const encrypted = encryptFileGCM(plaintext);

            const decrypted = decryptFileAuto(encrypted, 'aes-256-gcm');
            expect(decrypted.toString()).toBe('GCM data');
        });

        it('should throw error for unsupported algorithm', () => {
            const plaintext = Buffer.from('Data');
            const encrypted = encryptFile(plaintext);

            expect(() => decryptFileAuto(encrypted, 'aes-128-cbc')).toThrow(/Unsupported encryption algorithm/);
        });

        it('should throw error for unknown algorithm string', () => {
            const plaintext = Buffer.from('Data');
            const encrypted = encryptFile(plaintext);

            expect(() => decryptFileAuto(encrypted, 'xor')).toThrow(/Unsupported encryption algorithm/);
        });
    });
});
