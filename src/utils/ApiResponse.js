export class ApiResponse {
  constructor(data = {}, message = 'Request successful') {
    this.success = true;
    this.message = message;
    this.data = data;
  }

  static send(res, { statusCode = 200, data = {}, message = 'Request successful' } = {}) {
    return res.status(statusCode).json(new ApiResponse(data, message));
  }
}
