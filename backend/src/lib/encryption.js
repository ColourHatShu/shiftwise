/**
 * Document Encryption Service
 * 
 * Provides AES-256-CBC encryption for documents at rest.
 * All healthcare documents (PHI/PII) must be encrypted before storage.
 * 
 * @module lib/encryption
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size
const KEY_LENGTH = 32; // 256 bits

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
        console.error('[Encryption] Failed to encrypt file:', error.message);
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
        console.error('[Encryption] Failed to decrypt file:', error.message);
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
        console.error('[Encryption] encryptAndSaveFile failed:', error.message);
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
        console.error('[Encryption] readAndDecryptFile failed:', error.message);
        throw error;
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
        console.error('[Encryption] Setup validation failed:', error.message);
        return false;
    }
};

module.exports = {
    encryptFile,
    decryptFile,
    encryptAndSaveFile,
    readAndDecryptFile,
    generateEncryptionKey,
    validateEncryptionSetup,
    ALGORITHM
};
