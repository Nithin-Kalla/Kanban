import {z} from "zod";
import dotenv from "dotenv";

dotenv.config();

const EnvSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    /** How long a login lasts. Long enough not to interrupt development. */
    JWT_EXPIRES_IN: z.string().default("7d"),
    /**
     * Comma-separated list of origins the browser app is served from.
     *
     * Empty means "any origin", which is fine on a laptop and wrong in
     * production — so the server refuses to start without it there rather
     * than silently shipping an open API.
     */
    CORS_ORIGINS: z.string().default(""),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
    console.error(
        "❌ Invalid environment variables:",
        parsed.error.flatten().fieldErrors,
    );
    process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";

/**
 * Origins allowed to call this API, as the `cors` package wants them.
 *
 * `true` reflects whatever Origin the request carried — convenient locally,
 * unacceptable once the API is public, because any site could then drive it
 * with a visitor's credentials.
 */
export const corsOrigins: string[] | true = (() => {
    const configured = env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);

    if (configured.length > 0) return configured;

    if (isProduction) {
        console.error("❌ CORS_ORIGINS must be set in production");
        process.exit(1);
    }

    return true;
})();
