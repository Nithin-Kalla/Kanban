import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyToken } from "../auth/token.js";
import { canAccessBoard } from "../auth/boardAccess.js";
import { db } from "../prisma/db.js";
import { corsOrigins } from "../config/dotEnv.js";

/** Everyone viewing a given board shares one room. */
export const roomFor = (boardId: string) => `board-${boardId}`;

export type CardPayload = { id: string; title: string; position: number };
export type ColumnPayload = { id: string; name: string; position: number };
export type PresentUser = { id: string; username: string };

/**
 * Every broadcast a board viewer can receive, keyed by event name.
 *
 * Two rules hold for all of them: the payload names its `boardId`, so a
 * listener can ignore a board it is no longer looking at, and it carries
 * enough data to apply the change directly — a viewer never has to refetch the
 * board to find out what happened.
 */
export type BoardEvents = {
    "card-moved": { boardId: string; cardId: string; toColumnId: string; toIndex: number };
    "card-created": { boardId: string; columnId: string; card: CardPayload };
    "card-updated": { boardId: string; cardId: string; title: string };
    "card-deleted": { boardId: string; cardId: string };
    "column-created": { boardId: string; column: ColumnPayload };
    /**
     * Who is currently looking at the board.
     *
     * The whole list is sent every time rather than join/leave deltas. A delta
     * stream has to be applied in order and without gaps to stay correct, and
     * a client that misses one is wrong until it reloads; a full list is
     * idempotent, so a reconnecting client is immediately right again. The
     * list is a handful of names, so there is nothing to save by trimming it.
     */
    presence: { boardId: string; users: PresentUser[] };
};

let io: Server | undefined;

export const initRealtime = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        // Mirrors the Express cors() call: Socket.IO does its own CORS
        // handling, and Express middleware does not cover the handshake.
        cors: { origin: corsOrigins },
    });

    /**
     * Authenticates the connection itself, before any event reaches a handler.
     * Calling `next(error)` rejects the handshake outright.
     *
     * REST checks a header on every request; a socket is one long-lived
     * connection, so it is checked once here and the identity kept on the
     * socket (see src/types/socket.d.ts). The token arrives in
     * `handshake.auth` — the free-form object the client passes at connect
     * time — rather than a header, because the browser's WebSocket API cannot
     * set headers. Socket.IO resends it on every reconnect.
     *
     * A token that expires mid-connection leaves that socket alive until it
     * drops. That's acceptable: a socket can only receive, and everything that
     * changes data is a REST call that re-checks the token, so nothing can be
     * written on the strength of a stale socket.
     */
    io.use(async (socket, next) => {
        const claimed = verifyToken(socket.handshake.auth?.["token"]);
        if (!claimed) return next(new Error("Authentication required"));

        // Same reasoning as the REST middleware: a valid signature proves the
        // token was issued, not that the account still exists.
        const user = await db.orm.public.User
            .select("id", "username")
            .where({ id: claimed.id })
            .first();

        if (!user) return next(new Error("Session no longer valid"));

        socket.user = user;
        next();
    });

    io.on("connection", (socket) => {
        // Which boards this connection is watching. Kept here rather than read
        // back off `socket.rooms` so the disconnect handler doesn't have to
        // parse room names back into board ids.
        const watching = new Set<string>();

        /**
         * Joining is the real access boundary. Everyone in a room receives
         * every change to that board, so an unchecked join would leak a
         * board's contents to someone who could never write to it.
         */
        socket.on("join-board", async (boardId: unknown) => {
            const user = socket.user;
            if (typeof boardId !== "string" || !user) return;

            if (await canAccessBoard(db.orm, boardId, user.id)) {
                socket.join(roomFor(boardId));
                watching.add(boardId);
                // Sent to the whole room, the joiner included: they need the
                // list too, and it saves a separate "here's who's here" reply.
                broadcastPresence(boardId);
            }
            // Refused silently: the client finds out it can't see this board
            // from the REST fetch, which answers with a real status code.
        });

        socket.on("leave-board", (boardId: unknown) => {
            if (typeof boardId !== "string") return;

            socket.leave(roomFor(boardId));
            watching.delete(boardId);
            broadcastPresence(boardId);
        });

        // Socket.IO removes a socket from its rooms by itself, but nobody is
        // told. By `disconnect` that removal has happened, so recomputing
        // presence here yields the list without this connection in it.
        socket.on("disconnect", () => {
            for (const boardId of watching) broadcastPresence(boardId);
            watching.clear();
        });
    });

    return io;
};

/**
 * Everyone currently in a board's room.
 *
 * Derived from the room itself rather than from a presence map kept alongside
 * it — one source of truth, so presence can't drift out of step with who is
 * actually connected. Deduplicated by user id, since one person with the board
 * open in two tabs is still one person.
 *
 * This reads the in-memory adapter, so it sees only sockets on this process.
 * Running more than one instance would need the Redis adapter — at which point
 * rooms themselves would need it too, so presence isn't the thing that breaks
 * first.
 */
const presentOn = (boardId: string): PresentUser[] => {
    if (!io) return [];

    const members = io.sockets.adapter.rooms.get(roomFor(boardId)) ?? new Set<string>();
    const byUserId = new Map<string, PresentUser>();

    for (const socketId of members) {
        const user = io.sockets.sockets.get(socketId)?.user;
        if (user) byUserId.set(user.id, { id: user.id, username: user.username });
    }

    return [...byUserId.values()];
};

const broadcastPresence = (boardId: string) =>
    emitToBoard("presence", { boardId, users: presentOn(boardId) });

/**
 * Tells the other viewers of a board that something changed.
 *
 * The event name picks the payload type, so a name and a body that don't
 * belong together won't compile.
 *
 * `exceptSocketId` is the acting client's own socket. They already applied
 * this change themselves — optimistically, or from the response — so echoing
 * it back would at best be redundant and at worst fight with their in-flight
 * mutation. The id arrives on the HTTP request, since these are REST calls
 * rather than socket messages.
 *
 * Call this only once the write has committed: a broadcast for a rolled-back
 * change would leave every other viewer showing something the database never
 * had.
 */
export const emitToBoard = <E extends keyof BoardEvents>(
    event: E,
    payload: BoardEvents[E],
    exceptSocketId?: string,
) => {
    if (!io) return;

    const room = io.to(roomFor(payload.boardId));
    const target = exceptSocketId ? room.except(exceptSocketId) : room;
    target.emit(event, payload);
};
