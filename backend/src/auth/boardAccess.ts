import { AppError } from "../errors/AppError.js";
import type { Orm } from "../prisma/orm.js";

/**
 * Who may do what with a board.
 *
 * Two levels: an owner can do everything, including managing members; a member
 * can read and edit the board's contents. Everyone else gets a 404 rather than
 * a 403 — answering "this exists but isn't yours" confirms the id is real, so
 * an unauthorised board and a non-existent one are made indistinguishable.
 *
 * Every function takes the ORM rather than reaching for `db`, so a caller
 * already inside a transaction can pass `tx.orm` and have the check run on
 * that same connection. A helper that grabbed its own connection from the pool
 * mid-transaction couldn't see the transaction's writes, wouldn't be atomic
 * with them, and would deadlock the pool under load.
 */

/** True when `userId` owns the board or has been added to it. */
export const canAccessBoard = async (
    orm: Orm,
    boardId: string,
    userId: string,
): Promise<boolean> => {
    const board = await orm.public.Board.select("id", "ownerId").where({ id: boardId }).first();
    if (!board) return false;
    if (board.ownerId === userId) return true;

    const membership = await orm.public.BoardMember
        .select("id")
        .where({ boardId, userId })
        .first();

    return membership != null;
};

/** Throws 404 unless `userId` owns the board or has been added to it. */
export const assertBoardAccess = async (orm: Orm, boardId: string, userId: string) => {
    if (!(await canAccessBoard(orm, boardId, userId))) {
        throw new AppError(404, "Board not found");
    }
};

/**
 * Throws unless `userId` owns the board — for actions a mere member may not
 * take, such as adding another member.
 *
 * A member who tries gets a 403: they can already see the board, so there is
 * nothing left to hide and "you lack permission" is the more useful answer.
 */
export const assertBoardOwner = async (orm: Orm, boardId: string, userId: string) => {
    const board = await orm.public.Board.select("id", "ownerId").where({ id: boardId }).first();
    if (!board) throw new AppError(404, "Board not found");
    if (board.ownerId === userId) return;

    const member = await orm.public.BoardMember
        .select("id")
        .where({ boardId, userId })
        .first();

    throw member
        ? new AppError(403, "Only the board owner can do that")
        : new AppError(404, "Board not found");
};

/**
 * The board a column belongs to, or 404.
 *
 * Column and card routes name a column or a card, never a board, so the board
 * has to be resolved before access can be checked at all.
 */
export const boardIdOfColumn = async (orm: Orm, columnId: string): Promise<string> => {
    const column = await orm.public.Column.select("id", "boardId").where({ id: columnId }).first();
    if (!column) throw new AppError(404, "Column not found");
    return column.boardId;
};

/** The column and board a card belongs to, or 404. */
export const locateCard = async (orm: Orm, cardId: string) => {
    const card = await orm.public.Card.select("id", "columnId").where({ id: cardId }).first();
    if (!card) throw new AppError(404, "Card not found");

    return { columnId: card.columnId, boardId: await boardIdOfColumn(orm, card.columnId) };
};
