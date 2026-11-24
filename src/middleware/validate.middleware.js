/**
 * Zod request validation. Usage:
 *   router.post('/', validate({ body: schema, query: schema, params: schema }), handler)
 * Parsed values replace the originals; ZodErrors flow to the central error handler.
 */
export const validate = (schemas) => (req, _res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.query) {
      const parsed = schemas.query.parse(req.query);
      Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
    }
    next();
  } catch (err) {
    next(err);
  }
};
