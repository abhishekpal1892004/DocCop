import { randomUUID } from 'node:crypto';

const SAFE_ID = /^[a-zA-Z0-9_-]{8,64}$/;

export const requestIdMiddleware = (req, res, next) => {
  const incoming = req.get('X-Request-Id');
  const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
};
