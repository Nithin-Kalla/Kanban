/**
 * Operational error with an HTTP status code.
 * Throw this anywhere; the central errorHandler formats the response.
 */
export class AppError extends Error {
    constructor(
        public status: number,
        message: string,
        public details?: unknown,
    ) {
        super(message);
        this.name = "AppError";
    }
}
