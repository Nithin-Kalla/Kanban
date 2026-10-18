import { Request, Response } from "express";
import { db } from "../prisma/db.js";
import { emitToBoard } from "../realtime/socket.js";
import { assertBoardAccess } from "../auth/boardAccess.js";
import { requireUser } from "../middleware/utils.js";

export type CreateColumnBody = {
    boardId: string;
    name: string;
    /** The caller's socket id, so the broadcast can skip them. Optional: a
     *  client with no socket open still gets a valid column. */
    socketId?: string;
};

/**
 * Appends a column to the end of a board.
 *
 * Same shape as creating a card: check access, count the siblings inside the
 * transaction so two simultaneous creates can't both claim the same position,
 * then broadcast the row that was written.
 */
export const createColumn = async (
    req: Request<unknown, unknown, CreateColumnBody>,
    res: Response,
) => {
    const { boardId, name, socketId } = req.body;
    const user = requireUser(req);

    const column = await db.transaction(async (tx) => {
        await assertBoardAccess(tx.orm, boardId, user.id);

        const siblings = await tx.orm.public.Column.select("id").where({ boardId }).all();

        return await tx.orm.public.Column
            .select("id", "name", "position")
            .create({ name, position: siblings.length + 1, boardId });
    });

    emitToBoard("column-created", { boardId, column }, socketId);

    // The creator needs the row back: the id and position are the server's to
    // assign, so they had nothing to render optimistically.
    res.status(201).json(column);
};
