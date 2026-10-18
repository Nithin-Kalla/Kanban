import "express";
import type { AuthUser } from "../auth/token.js";

declare global {
    namespace Express {
        interface Request {
            /** Set by `isAuthenticated`. Present on every protected route. */
            user?: AuthUser;
        }
    }
}
