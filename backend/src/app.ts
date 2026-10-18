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

// Deploy platforms poll this to decide whether the instance is healthy, and it
// is the quickest way to tell a sleeping free-tier dyno from a broken one.
app.get("/health", (_req, res) => res.json({ ok: true }))

app.use(express.json())

app.use("/auth", authRouter);
app.use("/board", boardRouter);
app.use("/column", columnRouter);
app.use("/card", cardRouter);



app.use(pageNotFound);

app.use(errorHandler);

export default app;