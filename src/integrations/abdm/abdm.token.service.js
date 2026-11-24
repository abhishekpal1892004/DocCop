let cachedToken = null;
let expiresAtMs = 0;

export const abdmTokenService = {
  getCachedToken() {
    if (!cachedToken || Date.now() >= expiresAtMs - 30_000) {
      return null;
    }
    return cachedToken;
  },

  setCachedToken(token, expiresInSeconds = 1200) {
    cachedToken = token;
    expiresAtMs = Date.now() + Math.max(60, Number(expiresInSeconds) || 1200) * 1000;
  },

  clearCachedToken() {
    cachedToken = null;
    expiresAtMs = 0;
  },
};
