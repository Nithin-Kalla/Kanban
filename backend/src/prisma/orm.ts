import { db } from "./db.js";

/**
 * The ORM client, as reached either from the façade (`db.orm`) or from inside
 * a transaction (`tx.orm`) — they are the same type.
 *
 * Helpers take this instead of closing over `db`, so the caller decides
 * whether the queries join an open transaction.
 */
export type Orm = typeof db.orm;

/** The handle `db.transaction` hands its callback. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
