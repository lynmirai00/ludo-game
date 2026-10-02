import 'server-only';

// API errors carry a stable code only; the browser translates it (errors.<CODE>).
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export function errorResponse(status: number, code: string): Response {
  return Response.json({ error: { code } }, { status });
}

// Turns any thrown value into a JSON error response, never leaking details.
export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) return errorResponse(error.status, error.code);
  console.error(error);
  return errorResponse(500, 'INTERNAL_ERROR');
}
