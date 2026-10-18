import express from "express";
import cors from "cors";
import { corsOrigins } from "./config/dotEnv.js";
import authRouter from "./routers/authRoute.js";
import boardRouter from "./routers/boardRoute.js";
import columnRouter from "./routers/columnRoute.js";
import cardRouter from "./routers/cardRoute.js";
import { pageNotFound } from "./middleware/pageNotfound.js";
import { errorHandler } from "./errors/errorHandler.js";

const app = express();

// Locally this reflects any origin, so the Vite dev server on :5173 can read
// responses from this API on :3000. In production it is the explicit list from
// CORS_ORIGINS, and the server refuses to boot without one.
app.use(cors({ origin: corsOrigins }))

/**
 * Readiness probe. Render polls it, and the browser pings it on page load to
 * start waking a sleeping instance.
 *
 * Deliberately NOT called `/health`: EasyPrivacy ships the rule
 * `||onrender.com/health`, so Brave, uBlock Origin and AdGuard block that path
 * on every onrender.com host — the request never leaves the browser. The rule
 * matches by prefix, so `/healthz` and `/health-check` are blocked too. Don't
 * rename this back.
 */
app.get("/ready", (_req, res) => res.json({ ok: true }))

app.use(express.json())

app.use("/auth", authRouter);
app.use("/board", boardRouter);
app.use("/column", columnRouter);
app.use("/card", cardRouter);



app.use(pageNotFound);

app.use(errorHandler);

export default app;