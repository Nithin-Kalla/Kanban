import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../config/dotEnv.js";

/** Who the bearer of a token is. Kept small — it travels in every request. */
export type AuthUser = {
    id: string;
    username: string;
};

export const signToken = (user: AuthUser) =>
    jwt.sign(user, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    });

/**
 * Verifies a token and returns its user, or undefined if it is missing,
 * malformed, tampered with, or expired.
 *
 * Returning undefined rather than throwing is what lets the two callers —
 * the Express middleware and the Socket.IO handshake — each reject in the way
 * their own protocol expects.
 */
export const verifyToken = (token: string | undefined): AuthUser | undefined => {
    if (!token) return undefined;

    try {
        const payload = jwt.verify(token, env.JWT_SECRET);
        // A token signed with a bare string payload verifies to a string; only
        // an object carrying both fields is one of ours.
        if (typeof payload !== "object" || !payload.id || !payload.username) return undefined;

        return { id: String(payload.id), username: String(payload.username) };
    } catch {
        return undefined;
    }
};

/** Pulls the token out of an `Authorization: Bearer <token>` header. */
export const bearerToken = (header: string | undefined): string | undefined => {
    const [scheme, token] = header?.split(" ") ?? [];
    return scheme === "Bearer" ? token : undefined;
};
