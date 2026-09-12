/**
 * Consistent, structured API errors.
 *
 * Server functions never leak raw database messages or stack traces to the
 * client: every failure is mapped to a { code, message } pair.
 */
export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "ApiError";
    this.code = code;
  }
}

export function apiError(code: ApiErrorCode, message: string): ApiError {
  return new ApiError(code, message);
}

/** Maps a PostgREST error onto a safe, structured error. */
export function throwDbError(
  error: { code?: string; message?: string } | null,
  fallback = "The request could not be completed.",
): never {
  console.error("[db]", error);
  const code = error?.code ?? "";
  if (code === "42501" || code === "PGRST301") {
    throw apiError("FORBIDDEN", "You do not have access to this resource.");
  }
  if (code === "23505" || code === "23514") {
    throw apiError("CONFLICT", "That value conflicts with existing data.");
  }
  if (error?.message?.includes("Developers may only change task status")) {
    throw apiError("FORBIDDEN", "Developers may only change a task's status.");
  }
  throw apiError("INTERNAL_ERROR", fallback);
}

/** Turns any thrown value into a user-safe message. */
export function readableError(error: unknown): string {
  if (error instanceof Error) {
    const match = /^(?:[A-Z_]+): (.*)$/.exec(error.message);
    if (match?.[1]) return match[1];
    if (error.message.startsWith("Unauthorized")) return "Please sign in again.";
  }
  return "Something went wrong. Please try again.";
}
