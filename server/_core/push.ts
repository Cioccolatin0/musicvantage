import webpush from "web-push";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as socialDb from "./social-db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAPID_FILE = path.join(__dirname, "../../vapid-keys.json");

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

function getOrCreateVapidKeys(): VapidKeys {
  try {
    if (fs.existsSync(VAPID_FILE)) {
      return JSON.parse(fs.readFileSync(VAPID_FILE, "utf-8"));
    }
  } catch {}

  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2));
  console.log("[Push] Generated new VAPID keys");
  return keys;
}

const vapid = getOrCreateVapidKeys();

webpush.setVapidDetails(
  "mailto:push@musicstream.local",
  vapid.publicKey,
  vapid.privateKey
);

export function getVapidPublicKey(): string {
  return vapid.publicKey;
}

export async function sendPushNotification(userId: number, title: string, body: string, data?: Record<string, unknown>) {
  const subs = socialDb.getPushSubscriptions(userId);
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title,
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    timestamp: Date.now(),
    data: data || {},
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub as any, payload);
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        socialDb.removePushSubscription(userId, sub.endpoint);
      }
    }
  }
}
