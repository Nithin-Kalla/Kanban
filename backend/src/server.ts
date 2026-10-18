import { createServer } from "node:http";
import app from "./app.js";
import { env } from "./config/dotEnv.js";
import { checkDbConnection } from "./prisma/health.js";
import { initRealtime } from "./realtime/socket.js";

try {
    await checkDbConnection();
    console.log("✅ Database connected");
} catch (err) {
    console.error("❌ Database connection failed:", (err as Error).message);
    process.exit(1);
}

// Socket.IO shares the HTTP server with Express, so WebSocket upgrades and
// normal requests arrive on the same port. That means creating the server
// explicitly instead of letting app.listen() do it.
const httpServer = createServer(app);
initRealtime(httpServer);

httpServer.listen(env.PORT, () => {
    console.log(`Started listening on port: ${env.PORT}`);
});
