import { z } from "zod";

/** Register enforces today's password policy. */
export const RegisterSchema = z.object({
    username: z.string().trim().min(3).max(30),
    password: z.string().min(8).max(200),
});

/**
 * Login deliberately does *not* reuse the policy above: it only checks that
 * something was typed.
 *
 * If the register rules are ever tightened — say the minimum length goes from
 * 8 to 12 — a shared schema would reject existing users at validation before
 * bcrypt ever compared their (correct) password, locking them out of their own
 * accounts. Login's only job is "does this match the stored hash".
 */
export const LoginSchema = z.object({
    username: z.string().trim().min(1),
    password: z.string().min(1),
});

export type RegisterCredentials = z.infer<typeof RegisterSchema>;
export type LoginCredentials = z.infer<typeof LoginSchema>;

/** What the API hands back about a user. Never includes the password hash. */
export type PublicUser = {
    id: string;
    username: string;
};
