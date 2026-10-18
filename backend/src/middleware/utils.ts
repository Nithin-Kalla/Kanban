import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";
import {z} from "zod";
import { bearerToken, verifyToken } from "../auth/token.js";
import type { AuthUser } from "../auth/token.js";
import { db } from "../prisma/db.js";

export const verifyRequest = (schemas:{query?: z.ZodType, params?: z.ZodType, body?: z.ZodType}) => (req: Request, _res: Response, next: NextFunction) => {
    if(schemas.body){
        const r = schemas.body.safeParse(req.body);
        if (!r.success) throw new AppError(400, "Validation failed", z.flattenError(r.error).fieldErrors);
        req.body = r.data;
    }
    if(schemas.params){
        const r = schemas.params.safeParse(req.params);
        if (!r.success) throw new AppError(400, "Validation failed", z.flattenError(r.error).fieldErrors);
        req.params = r.data as typeof req.params;   // params is reassignable
    }
    if(schemas.query){
        const r = schemas.query.safeParse(req.query);
        if (!r.success) throw new AppError(400, "Validation failed", z.flattenError(r.error).fieldErrors);
        _res.locals.query = r.data;   // req.query is read-only in Express 5
    }

    next();
}

/**
 * Rejects a request that doesn't carry a valid `Authorization: Bearer` token.
 *
 * A good signature isn't enough: the token says who you are, not that you
 * still exist. An account deleted since the token was issued would otherwise
 * sail through here and only fail deeper in, as a foreign key violation and a
 * 500, when something tried to write a row owned by nobody.
 *
 * The cost is one primary-key lookup per request, which also buys the ability
 * to cut a session off — deleting the user ends their sessions immediately,
 * instead of leaving a signed token usable until it expires.
 */
export const isAuthenticated = async (req: Request, _res: Response, next: NextFunction) => {
    const claimed = verifyToken(bearerToken(req.headers.authorization));
    if (!claimed) throw new AppError(401, "Authentication required");

    const user = await db.orm.public.User.select("id", "username").where({ id: claimed.id }).first();
    if (!user) throw new AppError(401, "Session no longer valid");

    req.user = user;
    next();
};

/**
 * Reads the authenticated user off a request.
 *
 * `req.user` is optional on the type, because it's only set once
 * `isAuthenticated` has run. This narrows it for controllers mounted behind
 * that middleware, and throws loudly if one is ever mounted without it —
 * better a 500 than a route that silently treats everyone as anonymous.
 */
export const requireUser = (req: { user?: AuthUser }): AuthUser => {
    if (!req.user) throw new Error("requireUser called on an unauthenticated route");
    return req.user;
};

