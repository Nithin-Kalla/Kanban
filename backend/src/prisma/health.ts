import { db } from "./db.js";

/**
 * Verifies the database is reachable by issuing a real query.
 *
 * `db.connect()` is NOT a health check: the pool connects lazily, so it
 * resolves even against bad credentials. Only a real round-trip proves the
 * connection works — this one also confirms the schema is applied.
 */
export const checkDbConnection = async () => {
    await db.orm.public.Board.select("id").limit(1).all();
};
