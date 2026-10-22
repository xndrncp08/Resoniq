/** An error a route handler turns into its JSON response (see route() in lib/api.ts). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
  }
}
