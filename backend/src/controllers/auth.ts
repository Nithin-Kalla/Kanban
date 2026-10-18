import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { db } from "../prisma/db.js";
import { AppError } from "../errors/AppError.js";
import { signToken } from "../auth/token.js";
import { requireUser } from "../middleware/utils.js";
import type { LoginCredentials, PublicUser, RegisterCredentials } from "../types/users.js";

const ROUNDS = 10;

/**
 * The login response: the token, plus the user it belongs to.
 *
 * The user duplicates what's inside the JWT, deliberately. It keeps the token
 * opaque to the client — nothing out there has to know it's a JWT or parse it
 * to show a username, so swapping in opaque server-side session tokens later
 * wouldn't break a single caller.
 */
const session = (user: PublicUser) => ({ token: signToken(user), user });

export const register = async (
    req: Request<unknown, unknown, RegisterCredentials>,
    res: Response,
) => {
    const { username, password } = req.body;

    const existing = await db.orm.public.User.select("id").where({ username }).first();
    if (existing) throw new AppError(409, "That username is taken");

    const user = await db.orm.public.User
        .select("id", "username")
        .create({ username, password: await bcrypt.hash(password, ROUNDS) });

    res.status(201).json(session(user));
};

export const login = async (
    req: Request<unknown, unknown, LoginCredentials>,
    res: Response,
) => {
    const { username, password } = req.body;

    const user = await db.orm.public.User
        .select("id", "username", "password")
        .where({ username })
        .first();

    // When the username is unknown there is no hash to compare against, so
    // compare against a dummy one anyway. Skipping the work would make a
    // request for a non-existent user return noticeably faster than one for a
    // real user with the wrong password, and that timing difference alone
    // tells an attacker which usernames are registered.
    const matches = user
        ? await bcrypt.compare(password, user.password)
        : (await bcrypt.compare(password, DECOY_HASH), false);

    // One message for both failures, for the same reason.
    if (!user || !matches) throw new AppError(401, "Invalid credentials");

    res.json(session({ id: user.id, username: user.username }));
};

/** Lets a client holding a stored token confirm it's still valid on page load. */
export const me = (req: Request, res: Response) => {
    res.json({ user: requireUser(req) });
};

// Hashed once at startup: a valid bcrypt hash to compare against when the
// username doesn't exist, so that path costs the same as the real one.
const DECOY_HASH = bcrypt.hashSync("decoy-password", ROUNDS);
