import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { getFriends } from "./_core/social-db";

let wss: WebSocketServer;

interface WsClient {
  ws: WebSocket;
  userId: number;
}

const clients: WsClient[] = [];

export function setupWebSocket(server: Server) {
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    if (url.pathname !== "/ws") return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const userId = parseInt(url.searchParams.get("userId") || "0");

    if (!userId) {
      ws.close();
      return;
    }

    clients.push({ ws, userId });
    console.log(`[WS] User ${userId} connected (${clients.length} total)`);

    ws.on("close", async () => {
      const idx = clients.findIndex((c) => c.ws === ws);
      if (idx >= 0) clients.splice(idx, 1);
      console.log(`[WS] User ${userId} disconnected (${clients.length} total)`);

      // Broadcast "stopped" to friends so they know this user is offline
      const friends = await getFriends(userId);
      const friendIds = new Set(friends.map((f) => f.id));
      const stoppedMsg = JSON.stringify({ type: "stopped", userId });
      for (const client of clients) {
        if (friendIds.has(client.userId) && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(stoppedMsg);
        }
      }
    });

    ws.on("error", () => {
      const idx = clients.findIndex((c) => c.ws === ws);
      if (idx >= 0) clients.splice(idx, 1);
    });
  });
}

export function getConnectedUserIds(): number[] {
  return clients.map((c) => c.userId);
}

export async function broadcastActivity(userId: number, activity: {
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  trackThumbnail: string;
} | null) {
  const friends = await getFriends(userId);
  const friendIds = new Set(friends.map((f) => f.id));

  if (!activity) {
    // Broadcast "stopped" event
    const message = JSON.stringify({ type: "stopped", userId });
    for (const client of clients) {
      if (friendIds.has(client.userId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
    return;
  }

  const message = JSON.stringify({
    type: "activity",
    userId,
    activity,
  });

  for (const client of clients) {
    if (friendIds.has(client.userId) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}
