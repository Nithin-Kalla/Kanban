import "socket.io";
import type { AuthUser } from "../auth/token.js";

/**
 * Adds `user` to Socket.IO's own `Socket` type — the socket equivalent of what
 * express.d.ts does for `Request`.
 *
 * `interface` declarations merge, so this reopens socket.io's `Socket` rather
 * than replacing it: the result is everything the library declares plus this
 * field. Set once in the handshake middleware, read by the event handlers.
 *
 * Optional for the same reason `req.user` is: the compiler can't prove the
 * middleware ran, so readers guard before using it.
 */
declare module "socket.io" {
    interface Socket {
        user?: AuthUser;
    }
}
