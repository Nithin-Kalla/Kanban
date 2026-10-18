import { Router } from "express";
import { z } from "zod";
import { createCard, deleteCard, moveCard, updateCard } from "../controllers/card.js";
import { isAuthenticated, verifyRequest } from "../middleware/utils.js";

const cardRouter = Router();

// Every card belongs to a board, and no board is public.
cardRouter.use(isAuthenticated);

/** Identifies the caller's socket so the broadcast can leave them out. */
const socketId = z.string().min(1).optional();

cardRouter.post(
    "/",
    verifyRequest({
        body: z.object({
            columnId: z.uuid(),
            title: z.string().trim().min(1).max(200),
            socketId,
        }),
    }),
    createCard,
);

cardRouter.patch(
    "/:id/move",
    verifyRequest({
        params: z.object({ id: z.uuid() }),
        body: z.object({
            toColumnId: z.uuid(),
            toIndex: z.int().min(0),
            socketId,
        }),
    }),
    moveCard,
);

cardRouter.patch(
    "/:id",
    verifyRequest({
        params: z.object({ id: z.uuid() }),
        body: z.object({
            title: z.string().trim().min(1).max(200),
            socketId,
        }),
    }),
    updateCard,
);

cardRouter.delete(
    "/:id",
    verifyRequest({
        params: z.object({ id: z.uuid() }),
        query: z.object({ socketId }),
    }),
    deleteCard,
);

export default cardRouter;
