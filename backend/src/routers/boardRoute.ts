import { Router } from "express";
import { z } from "zod";
import {
    addMember,
    createBoard,
    getBoard,
    listBoards,
    listMembers,
} from "../controllers/board.js";
import { isAuthenticated, verifyRequest } from "../middleware/utils.js";

const boardRouter = Router();

// Nothing about a board is public, so the whole router is gated rather than
// each route remembering to ask.
boardRouter.use(isAuthenticated);

boardRouter.get("/", listBoards);

boardRouter.post(
    "/",
    verifyRequest({ body: z.object({ name: z.string().trim().min(1).max(100) }) }),
    createBoard,
);

boardRouter.get("/:id", verifyRequest({ params: z.object({ id: z.uuid() }) }), getBoard);

boardRouter.get(
    "/:id/members",
    verifyRequest({ params: z.object({ id: z.uuid() }) }),
    listMembers,
);

boardRouter.post(
    "/:id/members",
    verifyRequest({
        params: z.object({ id: z.uuid() }),
        body: z.object({ username: z.string().trim().min(1) }),
    }),
    addMember,
);

export default boardRouter;
