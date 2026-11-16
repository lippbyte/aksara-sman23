/** Galat aplikasi dengan kode HTTP dan kode galat yang stabil (AGENTS §4). */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);

export const unauthorized = (message = 'Silakan masuk terlebih dahulu.') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Anda tidak memiliki akses ke data ini.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Data tidak ditemukan.') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details);

export const businessRule = (message: string, details?: unknown) =>
  new AppError(422, 'BUSINESS_RULE', message, details);
