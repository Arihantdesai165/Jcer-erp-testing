export class HttpException extends Error {
  public status: number;
  public errorCode?: string;
  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends HttpException {
  constructor(message = 'Bad Request', errorCode?: string) {
    super(message, 400, errorCode);
  }
}

export class UnauthorizedError extends HttpException {
  constructor(message = 'Unauthorized', errorCode?: string) {
    super(message, 401, errorCode);
  }
}

export class ForbiddenError extends HttpException {
  constructor(message = 'Forbidden', errorCode?: string) {
    super(message, 403, errorCode);
  }
}

export class ForbiddenException extends ForbiddenError {
  constructor(message = 'Forbidden', errorCode?: string) {
    super(message, errorCode);
    this.name = 'ForbiddenException';
  }
}

export class NotFoundError extends HttpException {
  constructor(message = 'Not Found', errorCode?: string) {
    super(message, 404, errorCode);
  }
}

export class ConflictError extends HttpException {
  constructor(message = 'Conflict', errorCode?: string) {
    super(message, 409, errorCode);
  }
}

export class InternalServerError extends HttpException {
  constructor(message = 'Internal Server Error', errorCode?: string) {
    super(message, 500, errorCode);
  }
}
