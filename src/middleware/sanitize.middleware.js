/**
 * Strips MongoDB operator keys (`$...`) and dotted keys (`a.b`) from user-supplied
 * JSON bodies and query objects to prevent NoSQL operator injection.
 */
const sanitizeValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const clean = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      clean[key] = sanitizeValue(val);
    }
    return clean;
  }
  return value;
};

export const sanitizeMiddleware = (req, _res, next) => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    const cleanQuery = sanitizeValue(req.query);
    Object.defineProperty(req, 'query', { value: cleanQuery, writable: true, configurable: true });
  }
  next();
};
