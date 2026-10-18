import { Request, Response } from "express";
import { db } from "../prisma/db.js";
import { AppError } from "../errors/AppError.js";
import { assertBoardAccess, assertBoardOwner } from "../auth/boardAccess.js";
import { requireUser } from "../middleware/utils.js";

/**
 * Every board the caller can open: the ones they own, plus the ones they've
 * been added to.
 *
 * Two queries rather than one `OR` across a relation, because the result is a
 * plain concatenation — a board can't be both owned and joined, since the
 * owner never gets a BoardMember row.
 */
export const listBoards = async (req: Request, res: Response) => {
    const user = requireUser(req);

    const [owned, memberships] = await Promise.all([
        db.orm.public.Board
            .select("id", "name", "createdAt", "ownerId")
            .where({ ownerId: user.id })
            .orderBy((b) => b.createdAt.asc())
            .all(),
        db.orm.public.BoardMember
            .select("id")
            .where({ userId: user.id })
            .include("board", (board) => board.select("id", "name", "createdAt", "ownerId"))
            .orderBy((m) => m.createdAt.asc())
            .all(),
    ]);

    res.json({
        boards: [
            ...owned.map((board) => ({ ...board, role: "owner" as const })),
            ...memberships.map((membership) => ({ ...membership.board, role: "member" as const })),
        ],
    });
};

export type CreateBoardBody = { name: string };

/** Creates a board owned by the caller, with three columns to start from. */
export const createBoard = async (
    req: Request<unknown, unknown, CreateBoardBody>,
    res: Response,
) => {
    const user = requireUser(req);
    const { name } = req.body;

    const board = await db.transaction(async (tx) => {
        const board = await tx.orm.public.Board
            .select("id", "name", "createdAt", "ownerId")
            .create({ name, ownerId: user.id });

        // A board with no columns can't be dragged into, so there'd be an
        // add-column step between creating one and using it.
        for (const [index, columnName] of ["To Do", "In Progress", "Done"].entries()) {
            await tx.orm.public.Column.create({
                name: columnName,
                position: index + 1,
                boardId: board.id,
            });
        }

        return board;
    });

    res.status(201).json({ ...board, role: "owner" as const });
};

export const getBoard = async (req: Request<{ id: string }>, res: Response) => {
    const user = requireUser(req);
    await assertBoardAccess(db.orm, req.params.id, user.id);

    const board = await db.orm.public.Board
        .select("id", "name", "createdAt", "ownerId")
        .where({ id: req.params.id })
        .include("columns", (column) =>
            column
                .select("id", "name", "position")
                .orderBy((c) => c.position.asc())
                .include("cards", (card) =>
                    card
                        .select("id", "title", "position")
                        .orderBy((c) => c.position.asc()),
                ),
        )
        .first();

    // assertBoardAccess already proved this exists; this is for the types.
    if (!board) throw new AppError(404, "Board not found");

    res.json(board);
};

/** The owner plus everyone added to the board. */
export const listMembers = async (req: Request<{ id: string }>, res: Response) => {
    const user = requireUser(req);
    const boardId = req.params.id;
    await assertBoardAccess(db.orm, boardId, user.id);

    const board = await db.orm.public.Board
        .select("id", "ownerId")
        .where({ id: boardId })
        .include("owner", (owner) => owner.select("id", "username"))
        .include("members", (membership) =>
            membership.select("id").include("user", (u) => u.select("id", "username")),
        )
        .first();

    if (!board) throw new AppError(404, "Board not found");

    res.json({
        members: [
            { ...board.owner, role: "owner" as const },
            ...board.members.map((membership) => ({
                ...membership.user,
                role: "member" as const,
            })),
        ],
    });
};

export type AddMemberBody = { username: string };

/** Adds another user to a board. Owner only. */
export const addMember = async (
    req: Request<{ id: string }, unknown, AddMemberBody>,
    res: Response,
) => {
    const user = requireUser(req);
    const boardId = req.params.id;
    const { username } = req.body;

    const invitee = await db.transaction(async (tx) => {
        await assertBoardOwner(tx.orm, boardId, user.id);

        const invitee = await tx.orm.public.User
            .select("id", "username")
            .where({ username })
            .first();

        if (!invitee) throw new AppError(404, "No user with that username");
        if (invitee.id === user.id) throw new AppError(400, "You already own this board");

        const existing = await tx.orm.public.BoardMember
            .select("id")
            .where({ boardId, userId: invitee.id })
            .first();

        if (existing) throw new AppError(409, "Already a member of this board");

        await tx.orm.public.BoardMember.create({ boardId, userId: invitee.id });
        return invitee;
    });

    res.status(201).json({ ...invitee, role: "member" as const });
};
