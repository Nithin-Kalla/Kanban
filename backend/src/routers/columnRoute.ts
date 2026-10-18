import { Router } from "express";
import { z } from "zod";
import { createColumn } from "../controllers/column.js";
import { isAuthenticated, verifyRequest } from "../middleware/utils.js";

const columnRouter = Router();

// Every column belongs to a board, and no board is public.
columnRouter.use(isAuthenticated);

columnRouter.post(
    "/",
    verifyRequest({
        body: z.object({
            boardId: z.uuid(),
            name: z.string().trim().min(1).max(100),
            /** Identifies the caller's socket so the broadcast can skip them. */
            socketId: z.string().min(1).optional(),
        }),
    }),
    createColumn,
);

export default columnRouter;
