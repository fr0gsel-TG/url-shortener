/**
 * Базовый класс ожидаемых ("операционных") ошибок приложения.
 * Централизованный error handler отдаёт statusCode/message клиенту как есть.
 * Любая другая ошибка (не AppError) считается непредвиденной и превращается в 500.
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(400, message);
    this.name = 'BadRequestError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(500, message);
    this.name = 'InternalError';
  }
}
