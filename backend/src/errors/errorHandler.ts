import { Request, Response, NextFunction } from "express";
import { AppError } from "./AppError.js";

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
        return res.status(err.status).json({
            error: err.message,
            ...(err.details !== undefined ? { details: err.details } : {}),
        });
    }
    // Unexpected/programmer errors: log the detail, expose nothing.
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
}
