import { db } from "./db.js";
import type { Tx } from "./orm.js";

/**
 * Serialises everything that touches a column's card order.
 *
 * Positions are a dense 1..n sequence per column, and every mutation that
 * maintains it does read-then-write: count the siblings, compute a position,
 * write. Two of those interleaving produce duplicate positions and gaps —
 * eight concurrent creates in one column measurably yielded
 * [1,2,3,3,5,5,5,5,5,5]. A row lock on the owning Column turns the sequence
 * back into one-at-a-time.
 *
 * Locks are taken one row at a time in sorted id order. `WHERE id = ANY(...)`
 * would be one round trip, but Postgres locks in scan order rather than the
 * order written, so two transactions locking the same pair could each take one
 * and wait forever for the other. A consistent global order makes that
 * impossible.
 *
 * The lock is released when the transaction ends, either way.
 */
export const lockColumns = async (tx: Tx, ...columnIds: string[]) => {
    for (const id of [...new Set(columnIds)].sort()) {
        const plan = db.raw
            .sql`SELECT id FROM "Column" WHERE id = ${id} FOR UPDATE`
            .returnsRow({ id: "pg/text@1" })
            .build();
        await tx.query(plan);
    }
};

/** The same, for a board — so two columns can't claim one position. */
export const lockBoard = async (tx: Tx, boardId: string) => {
    const plan = db.raw
        .sql`SELECT id FROM "Board" WHERE id = ${boardId} FOR UPDATE`
        .returnsRow({ id: "pg/text@1" })
        .build();
    await tx.query(plan);
};
