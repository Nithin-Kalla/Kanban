import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, me, register } from "../controllers/auth.js";
import { isAuthenticated, verifyRequest } from "../middleware/utils.js";
import { LoginSchema, RegisterSchema } from "../types/users.js";

const authRouter = Router();

// Credential endpoints are the one place brute force pays off, so they get a
// much tighter budget than the rest of the API.
const credentialLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 10,
    message: { error: "Too many attempts, please try again later." },
});

authRouter.post("/register", credentialLimiter, verifyRequest({ body: RegisterSchema }), register);
authRouter.post("/login", credentialLimiter, verifyRequest({ body: LoginSchema }), login);

// Not rate limited the same way: the client calls this on every page load to
// check a stored token, and it costs nothing but a signature verification.
authRouter.get("/me", isAuthenticated, me);

export default authRouter;
