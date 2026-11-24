export class ApiError extends Error {
  constructor(statusCode, message, code = 'INTERNAL_SERVER_ERROR', details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = 'Bad request', code = 'BAD_REQUEST', details) {
    return new ApiError(400, message, code, details);
  }
  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new ApiError(401, message, code);
  }
  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new ApiError(403, message, code);
  }
  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, message, code);
  }
  static conflict(message = 'Conflict', code = 'CONFLICT') {
    return new ApiError(409, message, code);
  }
  static internal(message = 'Something went wrong') {
    return new ApiError(500, message, 'INTERNAL_SERVER_ERROR');
  }
}
