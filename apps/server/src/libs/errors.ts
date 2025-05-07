export class ApiError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}