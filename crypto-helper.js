/**
 * crypto-helper.js
 * Cryptographic helper for secure password hashing and JWT simulation.
 * Uses Web Crypto APIs for browser compatibility.
 */

(function () {
  const SECRET_KEY = "super-secret-blood-donation-key";

  // Helper to convert ArrayBuffer to Hex string
  function bufferToHex(buffer) {
    const hexCodes = [];
    const view = new DataView(buffer);
    for (let i = 0; i < view.byteLength; i += 4) {
      const value = view.getUint32(i);
      const stringValue = value.toString(16);
      const padding = '00000000';
      const paddedValue = (padding + stringValue).slice(-8);
      hexCodes.push(paddedValue);
    }
    return hexCodes.join('');
  }

  // SHA-256 hash using Web Crypto API (async)
  async function hashPassword(password) {
    if (!password) return "";
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    return bufferToHex(hashBuffer);
  }

  // Helper to base64 encode strings
  function base64UrlEncode(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Helper to base64 decode strings
  function base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return decodeURIComponent(escape(atob(base64)));
  }

  // Simulates JWT creation: header.payload.signature
  async function generateJWT(payload) {
    const header = { alg: "HS256", typ: "JWT" };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    
    // Set expiration to 1 hour from now
    const extendedPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    const encodedPayload = base64UrlEncode(JSON.stringify(extendedPayload));
    
    // Simulate HMAC signature by hashing the header + payload + secret key
    const rawSignature = `${encodedHeader}.${encodedPayload}.${SECRET_KEY}`;
    const signatureHash = await hashPassword(rawSignature);
    const encodedSignature = base64UrlEncode(signatureHash);
    
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  // Verify and decode JWT
  async function verifyJWT(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    
    try {
      // Re-verify signature
      const rawSignature = `${encodedHeader}.${encodedPayload}.${SECRET_KEY}`;
      const signatureHash = await hashPassword(rawSignature);
      const expectedSignature = base64UrlEncode(signatureHash);
      
      if (encodedSignature !== expectedSignature) {
        console.warn("JWT Verification failed: signature mismatch");
        return null;
      }
      
      const payload = JSON.parse(base64UrlDecode(encodedPayload));
      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        console.warn("JWT Verification failed: token expired");
        return null;
      }
      
      return payload;
    } catch (e) {
      console.error("JWT Verification error:", e);
      return null;
    }
  }

  // Export helper methods to global scope
  window.cryptoHelper = {
    hashPassword,
    generateJWT,
    verifyJWT
  };
})();
