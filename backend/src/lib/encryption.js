/**
 * Document Encryption Service
 * 
 * Provides AES-256-CBC encryption for documents at rest.
 * All healthcare documents (PHI/PII) must be encrypted before storage.
 * 
 * @module lib/encryption
 */

const crypto = require('crypto');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size (for CBC)
const KEY_LENGTH = 32; // 256 bits

// GCM Constants
const GCM_ALGORITHM = 'aes-256-gcm';
const GCM_IV_LENGTH = 12; // Standard GCM IV size
const GCM_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Get encryption key from environment
 * Validates key format and length
 */
const getEncryptionKey = () => {
    const keyHex = process.env.DOCUMENT_ENCRYPTION_KEY;
    
    if (!keyHex) {
        throw new Error('DOCUMENT_ENCRYPTION_KEY environment variable is not set');
    }
    
    // Remove any whitespace or quotes
    const cleanKey = keyHex.trim().replace(/['"]/g, '');
    
    if (cleanKey.length !== 64) { // 32 bytes = 64 hex characters
        throw new Error(`DOCUMENT_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Got ${cleanKey.length} characters.`);
    }
    
    // Validate hex format
    if (!/^[0-9a-fA-F]+$/.test(cleanKey)) {
        throw new Error('DOCUMENT_ENCRYPTION_KEY must be valid hexadecimal');
    }
    
    return Buffer.from(cleanKey, 'hex');
};

/**
 * Encrypt a file buffer using AES-256-CBC
 * Returns encrypted data with IV prepended
 * 
 * @param {Buffer} fileBuffer - The file data to encrypt
 * @returns {Buffer} - Encrypted data (IV + ciphertext)
 */
const encryptFile = (fileBuffer) => {
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
        
        // Prepend IV to encrypted data (IV is not secret, just needs to be unique)
        return Buffer.concat([iv, encrypted]);
    } catch (error) {
        logger.error({ err: error }, '[Encryption] Failed to encrypt file');
        throw new Error('Document encryption failed');
    }
};

/**
 * Decrypt a file buffer using AES-256-CBC
 * Expects IV prepended to encrypted data
 * 
 * @param {Buffer} encryptedBuffer - The encrypted data (IV + ciphertext)
 * @returns {Buffer} - Decrypted original data
 */
const decryptFile = (encryptedBuffer) => {
    try {
        const key = getEncryptionKey();
        
        // Extract IV from beginning of buffer
        const iv = encryptedBuffer.slice(0, IV_LENGTH);
        const encrypted = encryptedBuffer.slice(IV_LENGTH);
        
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        
        return decrypted;
    } catch (error) {
        logger.error({ err: error }, '[Encryption] Failed to decrypt file');
        throw new Error('Document decryption failed - file may be corrupted or encryption key mismatch');
    }
};

/**
 * Encrypt and save a file to disk
 * 
 * @param {string} sourcePath - Path to original file
 * @param {string} destPath - Path for encrypted file
 * @returns {Promise<{originalSize: number, encryptedSize: number}>}
 */
const encryptAndSaveFile = async (sourcePath, destPath) => {
    try {
        const fileBuffer = fs.readFileSync(sourcePath);
        const encrypted = encryptFile(fileBuffer);
        
        fs.writeFileSync(destPath, encrypted);
        
        // Securely delete original (overwrite then delete)
        const overwriteBuffer = Buffer.alloc(fileBuffer.length, 0);
        fs.writeFileSync(sourcePath, overwriteBuffer);
        fs.unlinkSync(sourcePath);
        
        return {
            originalSize: fileBuffer.length,
            encryptedSize: encrypted.length,
            encryptionAlgorithm: ALGORITHM
        };
    } catch (error) {
        logger.error({ err: error }, '[Encryption] encryptAndSaveFile failed');
        throw error;
    }
};

/**
 * Read and decrypt a file from disk
 * 
 * @param {string} encryptedPath - Path to encrypted file
 * @returns {Buffer} - Decrypted file buffer
 */
const readAndDecryptFile = (encryptedPath) => {
    try {
        if (!fs.existsSync(encryptedPath)) {
            throw new Error(`Encrypted file not found: ${encryptedPath}`);
        }
        
        const encryptedBuffer = fs.readFileSync(encryptedPath);
        return decryptFile(encryptedBuffer);
    } catch (error) {
        logger.error({ err: error }, '[Encryption] readAndDecryptFile failed');
        throw error;
    }
};

/**
 * Encrypt a file buffer using AES-256-GCM
 * Returns encrypted data with IV and auth tag prepended.
 * Layout: [IV(12) | authTag(16) | ciphertext]
 *
 * @param {Buffer} fileBuffer - The file data to encrypt
 * @returns {Buffer} - Encrypted data (IV + authTag + ciphertext)
 */
const encryptFileGCM = (fileBuffer) => {
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(GCM_IV_LENGTH);

        const cipher = crypto.createCipheriv(GCM_ALGORITHM, key, iv);
        const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
        const authTag = cipher.getAuthTag(); // MUST be called AFTER final()

        // Prepend IV and authTag to ciphertext
        return Buffer.concat([iv, authTag, encrypted]);
    } catch (error) {
        logger.error({ err: error }, '[Encryption GCM] Failed to encrypt file');
        throw new Error('Document GCM encryption failed');
    }
};

/**
 * Decrypt a file buffer using AES-256-GCM
 * Expects IV(12) | authTag(16) | ciphertext layout.
 * Throws a tagged error on authentication failure.
 *
 * @param {Buffer} encryptedBuffer - The encrypted data (IV + authTag + ciphertext)
 * @returns {Buffer} - Decrypted original data
 * @throws {Error} with code='GCM_AUTH_FAIL' on auth tag mismatch
 */
const decryptFileGCM = (encryptedBuffer) => {
    try {
        const key = getEncryptionKey();

        // Extract IV, authTag, and ciphertext from buffer
        const iv = encryptedBuffer.slice(0, GCM_IV_LENGTH);
        const authTag = encryptedBuffer.slice(GCM_IV_LENGTH, GCM_IV_LENGTH + GCM_TAG_LENGTH);
        const ciphertext = encryptedBuffer.slice(GCM_IV_LENGTH + GCM_TAG_LENGTH);

        const decipher = crypto.createDecipheriv(GCM_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag); // MUST be called BEFORE update()
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

        return decrypted;
    } catch (error) {
        // GCM authentication failure is indicated in the error message
        // Common messages: "Unsupported state or unable to authenticate data"
        if (error instanceof Error && (error.message.includes('auth') || error.message.includes('Unsupported state'))) {
            const gcmError = new Error('GCM auth failure');
            gcmError.code = 'GCM_AUTH_FAIL';
            throw gcmError;
        }
        logger.error({ err: error }, '[Encryption GCM] Failed to decrypt file');
        const decryptError = new Error('Document GCM decryption failed');
        decryptError.code = 'GCM_DECRYPT_ERROR';
        throw decryptError;
    }
};

/**
 * Decrypt a file buffer using the appropriate algorithm.
 * Routes to either decryptFile (CBC) or decryptFileGCM based on algorithm string.
 *
 * @param {Buffer} encryptedBuffer - The encrypted data
 * @param {string} algorithm - The encryption algorithm ('aes-256-cbc' or 'aes-256-gcm')
 * @returns {Buffer} - Decrypted original data
 * @throws {Error} on unsupported algorithm or decryption failure
 */
const decryptFileAuto = (encryptedBuffer, algorithm) => {
    if (algorithm === 'aes-256-cbc') {
        return decryptFile(encryptedBuffer);
    } else if (algorithm === 'aes-256-gcm') {
        return decryptFileGCM(encryptedBuffer);
    } else {
        throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
    }
};

/**
 * Generate a new encryption key (for initial setup)
 * @returns {string} - 64 character hex string
 */
const generateEncryptionKey = () => {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
};

/**
 * Validate that encryption is properly configured
 * @returns {boolean}
 */
const validateEncryptionSetup = () => {
    try {
        getEncryptionKey();
        return true;
    } catch (error) {
        logger.error({ err: error }, '[Encryption] Setup validation failed');
        return false;
    }
};

module.exports = {
    encryptFile,
    decryptFile,
    encryptFileGCM,
    decryptFileGCM,
    decryptFileAuto,
    encryptAndSaveFile,
    readAndDecryptFile,
    generateEncryptionKey,
    validateEncryptionSetup,
    ALGORITHM,
    GCM_ALGORITHM,
    GCM_IV_LENGTH,
    GCM_TAG_LENGTH
};
