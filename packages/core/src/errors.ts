export class CocoError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code = 'unknown_error', details?: unknown) {
    super(message);
    this.name = 'CocoError';
    this.code = code;
    this.details = details;
  }
}
