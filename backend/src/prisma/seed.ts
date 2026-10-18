import bcrypt from "bcrypt";
import { db } from "./db.js";

// Re-runnable: clear existing rows first. Boards, columns and cards all go
// with their owner via `onDelete: Cascade`, so deleting users is enough.
//
// This has to go through the SQL lane. The ORM's `.where({}).delete()` looks
// like "delete everything" but deletes a *single* row and returns it, so a
// re-run would hit the unique constraint on username instead of starting fresh.
await db.runtime().execute(db.sql.public.User.delete().build());

// Two accounts, so the collaborative half of the app can actually be tried:
// sign in as each in two browser profiles and watch one board update live.
const password = await bcrypt.hash("password123", 10);

const alice = await db.orm.public.User.create({ username: "alice", password });
const bob = await db.orm.public.User.create({ username: "bob", password });

const board = await db.orm.public.Board.create({
    name: "Test Board 1",
    ownerId: alice.id,
});

// Bob can see and edit Alice's board, but can't manage its members.
await db.orm.public.BoardMember.create({ boardId: board.id, userId: bob.id });

// A board only Alice can reach, to prove the access check actually refuses.
await db.orm.public.Board.create({ name: "Alice's private board", ownerId: alice.id });

const todo = await db.orm.public.Column.create({ name: "To Do", position: 1, boardId: board.id });
const doing = await db.orm.public.Column.create({ name: "In Progress", position: 2, boardId: board.id });
const done = await db.orm.public.Column.create({ name: "Done", position: 3, boardId: board.id });

await db.orm.public.Card.create({ title: "Set up Prisma", position: 1, columnId: done.id });
await db.orm.public.Card.create({ title: "Build board API", position: 1, columnId: doing.id });
await db.orm.public.Card.create({ title: "Drag and drop cards", position: 1, columnId: todo.id });
await db.orm.public.Card.create({ title: "Deploy", position: 2, columnId: todo.id });

console.log(
    `Seeded users alice & bob (password: password123)\n` +
    `  "${board.name}" — owned by alice, bob is a member\n` +
    `  "Alice's private board" — alice only`,
);

// Required: the Postgres pool keeps Node's event loop alive.
await db.close();
