import { HttpErrorResponse } from '@angular/common/http';

/** An API failure with a message that is safe to show to people as-is. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    readonly body: Record<string, unknown> | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return new ApiError(
          "Can't reach the server. Check your connection and try again.",
          0,
          'NETWORK',
          null,
        );
      }
      const body =
        error.error && typeof error.error === 'object'
          ? (error.error as Record<string, unknown>)
          : null;
      const detail = body?.['detail'];
      const code = body?.['code'];
      return new ApiError(
        typeof detail === 'string' && detail ? detail : fallbackMessage(error.status),
        error.status,
        typeof code === 'string' ? code : null,
        body,
      );
    }
    return new ApiError('Something went wrong. Please try again.', -1, null, null);
  }
}

function fallbackMessage(status: number): string {
  if (status === 404) return "This list doesn't exist or was deleted by the host.";
  if (status === 401) return 'Please join the list with your name first.';
  if (status === 403) return 'Only the host can do that.';
  if (status >= 500) return 'The server had a problem. Please try again in a moment.';
  return 'Something went wrong. Please try again.';
}
