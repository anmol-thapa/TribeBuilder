// Shared encryption utilities for sensitive data
// Uses AES-GCM encryption via Web Crypto API

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

/**
 * Derives an encryption key from the ENCRYPTION_KEY secret
 */
async function deriveKey(secret: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a string value using AES-GCM
 * Returns base64-encoded string: salt:iv:ciphertext
 */
export async function encrypt(plaintext: string): Promise<string> {
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
  if (!encryptionKey) {
    console.warn('ENCRYPTION_KEY not set - storing data unencrypted');
    return plaintext;
  }

  try {
    const encoder = new TextEncoder();
    const saltArray = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const ivArray = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    
    // Convert to ArrayBuffer for crypto operations
    const salt = saltArray.buffer.slice(saltArray.byteOffset, saltArray.byteOffset + saltArray.byteLength);
    const iv = ivArray.buffer.slice(ivArray.byteOffset, ivArray.byteOffset + ivArray.byteLength);
    
    const key = await deriveKey(encryptionKey, salt);

    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv: iv },
      key,
      encoder.encode(plaintext)
    );

    // Combine salt, iv, and ciphertext
    const ciphertextArray = new Uint8Array(ciphertext);
    const combined = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertextArray.length);
    combined.set(saltArray, 0);
    combined.set(ivArray, SALT_LENGTH);
    combined.set(ciphertextArray, SALT_LENGTH + IV_LENGTH);

    // Return as base64 with prefix to identify encrypted values
    return 'enc:' + btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt sensitive data');
  }
}

/**
 * Decrypts a value encrypted with the encrypt function
 * Handles both encrypted (enc: prefix) and legacy unencrypted values
 */
export async function decrypt(encryptedValue: string): Promise<string> {
  // Handle legacy unencrypted values
  if (!encryptedValue.startsWith('enc:')) {
    return encryptedValue;
  }

  const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY required to decrypt data');
  }

  try {
    // Remove prefix and decode base64
    const combined = Uint8Array.from(atob(encryptedValue.slice(4)), c => c.charCodeAt(0));

    // Extract salt, iv, and ciphertext
    const saltArray = combined.slice(0, SALT_LENGTH);
    const ivArray = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const ciphertextArray = combined.slice(SALT_LENGTH + IV_LENGTH);

    // Convert to ArrayBuffer
    const salt = saltArray.buffer.slice(saltArray.byteOffset, saltArray.byteOffset + saltArray.byteLength);
    const iv = ivArray.buffer.slice(ivArray.byteOffset, ivArray.byteOffset + ivArray.byteLength);
    const ciphertext = ciphertextArray.buffer.slice(ciphertextArray.byteOffset, ciphertextArray.byteOffset + ciphertextArray.byteLength);

    const key = await deriveKey(encryptionKey, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt sensitive data');
  }
}

/**
 * Encrypts multiple token fields for storage
 */
export async function encryptTokens(tokens: {
  access_token?: string;
  access_token_secret?: string;
  refresh_token?: string;
}): Promise<{
  access_token?: string;
  access_token_secret?: string;
  refresh_token?: string;
}> {
  const result: typeof tokens = {};
  
  if (tokens.access_token) {
    result.access_token = await encrypt(tokens.access_token);
  }
  if (tokens.access_token_secret) {
    result.access_token_secret = await encrypt(tokens.access_token_secret);
  }
  if (tokens.refresh_token) {
    result.refresh_token = await encrypt(tokens.refresh_token);
  }
  
  return result;
}

/**
 * Decrypts multiple token fields from storage
 */
export async function decryptTokens(tokens: {
  access_token?: string;
  access_token_secret?: string;
  refresh_token?: string;
}): Promise<{
  access_token?: string;
  access_token_secret?: string;
  refresh_token?: string;
}> {
  const result: typeof tokens = {};
  
  if (tokens.access_token) {
    result.access_token = await decrypt(tokens.access_token);
  }
  if (tokens.access_token_secret) {
    result.access_token_secret = await decrypt(tokens.access_token_secret);
  }
  if (tokens.refresh_token) {
    result.refresh_token = await decrypt(tokens.refresh_token);
  }
  
  return result;
}
