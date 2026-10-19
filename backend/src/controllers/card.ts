import { Request, Response } from "express";
import { db } from "../prisma/db.js";
import { AppError } from "../errors/AppError.js";
import { emitToBoard } from "../realtime/socket.js";
import { assertBoardAccess, boardIdOfColumn, locateCard } from "../auth/boardAccess.js";
import { requireUser } from "../middleware/utils.js";
import type { Orm } from "../prisma/orm.js";
import { lockColumns } from "../prisma/locks.js";

/** Ids of a column's cards, in display order. */
const orderedIds = async (orm: Orm, columnId: string) => {
    const cards = await orm.public.Card
        .select("id")
        .where({ columnId })
        .orderBy((c) => c.position.asc())
        .all();
    return cards.map((c) => c.id);
};

/** Rewrites a column's cards to positions 1..n in list order. */
const renumber = async (orm: Orm, ids: string[], columnId: string) => {
    for (const [index, cardId] of ids.entries()) {
        await orm.public.Card
            .where({ id: cardId })
            .update({ position: index + 1, columnId });
    }
};

export type MoveCardBody = {
    toColumnId: string;
    toIndex: number;
    /** The caller's socket id, so the broadcast can skip them. Optional: a
     *  client with no socket open still gets a valid move. */
    socketId?: string;
};

/**
 * Moves a card to `toIndex` within `toColumnId` (same column = reorder).
 *
 * Positions are stored as a dense 1..n sequence per column. Rather than doing
 * gap arithmetic, this rebuilds the affected columns' orders in full: pull the
 * sibling list, splice the card into place, and rewrite every position. That is
 * O(n) writes per move, which is fine at board scale and leaves no room for the
 * duplicate/drifting positions that gap schemes accumulate.
 *
 * The whole thing runs in one transaction so a failure part-way cannot leave
 * the board with a half-renumbered column, and so the access check and the
 * writes it authorises see the same snapshot.
 */
export const moveCard = async (
    req: Request<{ id: string }, unknown, MoveCardBody>,
    res: Response,
) => {
    const { id } = req.params;
    const { toColumnId, toIndex, socketId } = req.body;
    const user = requireUser(req);

    const boardId = await db.transaction(async (tx) => {
        // Read once to learn which columns are involved, lock them, then read
        // again. Only the second read is trustworthy: until the locks are
        // held, another transaction can move or delete this card underneath
        // us, and acting on the first read is what produced a 500 when a move
        // raced a delete.
        const before = await tx.orm.public.Card
            .select("id", "columnId")
            .where({ id })
            .first();

        if (!before) throw new AppError(404, "Card not found");

        await lockColumns(tx, before.columnId, toColumnId);

        const card = await tx.orm.public.Card
            .select("id", "columnId")
            .where({ id })
            .first();

        // Deleted while we waited for the lock.
        if (!card) throw new AppError(404, "Card not found");

        // Moved elsewhere while we waited: its real source isn't the column we
        // locked, so take that one too before touching its order.
        if (card.columnId !== before.columnId) {
            await lockColumns(tx, card.columnId);
        }

        const [fromColumn, toColumn] = await Promise.all([
            tx.orm.public.Column.select("id", "boardId").where({ id: card.columnId }).first(),
            tx.orm.public.Column.select("id", "boardId").where({ id: toColumnId }).first(),
        ]);

        if (!toColumn) throw new AppError(404, "Destination column not found");
        // A card may only move between columns of its own board.
        if (!fromColumn || fromColumn.boardId !== toColumn.boardId) {
            throw new AppError(400, "Cannot move a card to a different board");
        }

        await assertBoardAccess(tx.orm, toColumn.boardId, user.id);

        if (card.columnId === toColumnId) {
            const ids = (await orderedIds(tx.orm, toColumnId)).filter((c) => c !== id);
            ids.splice(clamp(toIndex, ids.length), 0, id);
            await renumber(tx.orm, ids, toColumnId);
            return toColumn.boardId;
        }

        const fromIds = (await orderedIds(tx.orm, card.columnId)).filter((c) => c !== id);
        const toIds = await orderedIds(tx.orm, toColumnId);
        toIds.splice(clamp(toIndex, toIds.length), 0, id);

        await renumber(tx.orm, fromIds, card.columnId);
        await renumber(tx.orm, toIds, toColumnId);

        return toColumn.boardId;
    });

    emitToBoard("card-moved", { boardId, cardId: id, toColumnId, toIndex }, socketId);

    res.status(204).end();
};

export type CreateCardBody = {
    columnId: string;
    title: string;
    socketId?: string;
};

/**
 * Appends a card to the end of `columnId`.
 *
 * The position is derived from the current sibling count inside the
 * transaction, so two simultaneous creates can't both claim the same slot.
 */
export const createCard = async (
    req: Request<unknown, unknown, CreateCardBody>,
    res: Response,
) => {
    const { columnId, title, socketId } = req.body;
    const user = requireUser(req);

    const { boardId, card } = await db.transaction(async (tx) => {
        const boardId = await boardIdOfColumn(tx.orm, columnId);
        await assertBoardAccess(tx.orm, boardId, user.id);

        // Counting siblings and inserting at count+1 is a read-then-write;
        // without the lock, simultaneous creates all read the same count and
        // claim the same position.
        await lockColumns(tx, columnId);

        const siblings = await orderedIds(tx.orm, columnId);
        const card = await tx.orm.public.Card
            .select("id", "title", "position")
            .create({ title, position: siblings.length + 1, columnId });

        return { boardId, card };
    });

    emitToBoard("card-created", { boardId, columnId, card }, socketId);

    // The creator needs the row back: the id and position are the server's to
    // assign, so they had nothing to render optimistically.
    res.status(201).json(card);
};

export type UpdateCardBody = {
    title: string;
    socketId?: string;
};

/** Renames a card. */
export const updateCard = async (
    req: Request<{ id: string }, unknown, UpdateCardBody>,
    res: Response,
) => {
    const { id } = req.params;
    const { title, socketId } = req.body;
    const user = requireUser(req);

    const boardId = await db.transaction(async (tx) => {
        const { boardId } = await locateCard(tx.orm, id);
        await assertBoardAccess(tx.orm, boardId, user.id);

        await tx.orm.public.Card.where({ id }).update({ title });
        return boardId;
    });

    emitToBoard("card-updated", { boardId, cardId: id, title }, socketId);

    res.status(204).end();
};

/**
 * Deletes a card and closes the gap it leaves behind, keeping the column's
 * positions a dense 1..n sequence.
 */
export const deleteCard = async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const user = requireUser(req);
    // A DELETE carries no body, so the caller's socket id rides along as a
    // query param instead. Express 5 makes req.query read-only, so the
    // validated copy lands in res.locals.
    const { socketId } = res.locals["query"] as { socketId?: string };

    const boardId = await db.transaction(async (tx) => {
        const { boardId, columnId } = await locateCard(tx.orm, id);
        await assertBoardAccess(tx.orm, boardId, user.id);

        await lockColumns(tx, columnId);

        // Re-read under the lock. `locateCard` above ran before it, so its
        // column may already be stale — and renumbering the column the card
        // *used* to be in leaves a gap in the one it actually left.
        const card = await tx.orm.public.Card.select("id", "columnId").where({ id }).first();
        if (!card) throw new AppError(404, "Card not found");

        if (card.columnId !== columnId) {
            await lockColumns(tx, card.columnId);
        }

        await tx.orm.public.Card.where({ id }).delete();
        await renumber(tx.orm, await orderedIds(tx.orm, card.columnId), card.columnId);

        return boardId;
    });

    emitToBoard("card-deleted", { boardId, cardId: id }, socketId);

    res.status(204).end();
};

// Drop targets can report an index past the end of a shrinking list; treating
// that as "append" is friendlier than rejecting the move.
const clamp = (index: number, max: number) => Math.min(Math.max(index, 0), max);
