import { COOKIE_NAME } from "../../shared/const";
import { getUserByOpenId } from "../../db";
import * as localAuth from "./localAuth";
import type { Request } from "express";

export function getSessionCookieOptions(req: Request) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

export async function getSessionFromCookie(req: Request) {
  const cookie = req.cookies?.[COOKIE_NAME];
  if (!cookie) return undefined;

  try {
    const payload = JSON.parse(Buffer.from(cookie, "base64").toString("utf-8"));

    // Local auth session (email-based)
    if (payload.email && payload.userId) {
      const user = await localAuth.getSessionUser(payload.email);
      if (!user) return undefined;
      return {
        id: payload.userId,
        email: payload.email,
        name: payload.name,
        openId: payload.email,
      };
    }

    // OAuth session (openId-based)
    if (payload.openId) {
      const user = await getUserByOpenId(payload.openId);
      return user;
    }

    return undefined;
  } catch {
    return undefined;
  }
}
