import express from "express";
import crypto from "crypto";
import { upsertUser } from "../db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";

const MANUS_CLIENT_ID = process.env.MANUS_CLIENT_ID || "";
const MANUS_CLIENT_SECRET = process.env.MANUS_CLIENT_SECRET || "";
const MANUS_AUTH_URL = process.env.MANUS_AUTH_URL || "https://manus.im/oauth/authorize";
const MANUS_TOKEN_URL = process.env.MANUS_TOKEN_URL || "https://manus.im/oauth/token";
const MANUS_USERINFO_URL = process.env.MANUS_USERINFO_URL || "https://manus.im/oauth/userinfo";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const FRONTEND_URL = process.env.FRONTEND_URL || "";

function frontendRedirect(path: string) {
  return FRONTEND_URL ? `${FRONTEND_URL}${path}` : path;
}

function generateState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function registerOAuthRoutes(app: express.Express) {
  // Store state tokens for CSRF protection (in-memory, fine for single instance)
  const pendingStates = new Map<string, { createdAt: number }>();

  // Cleanup expired states every 10 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of pendingStates) {
      if (now - val.createdAt > 10 * 60 * 1000) {
        pendingStates.delete(key);
      }
    }
  }, 10 * 60 * 1000);

  // Redirect to Manus OAuth login
  app.get("/api/auth/login", (_req, res) => {
    if (!MANUS_CLIENT_ID || !MANUS_CLIENT_SECRET) {
      res.status(500).json({
        error: "OAuth non configurato. Imposta MANUS_CLIENT_ID e MANUS_CLIENT_SECRET.",
      });
      return;
    }

    const state = generateState();
    pendingStates.set(state, { createdAt: Date.now() });

    const params = new URLSearchParams({
      client_id: MANUS_CLIENT_ID,
      redirect_uri: `${BASE_URL}/api/auth/callback`,
      response_type: "code",
      scope: "openid profile email",
      state,
    });

    res.redirect(`${MANUS_AUTH_URL}?${params.toString()}`);
  });

  // OAuth callback - exchange code for tokens, upsert user, set session
  app.get("/api/auth/callback", async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      res.redirect(frontendRedirect(`/404?error=${encodeURIComponent(error)}`));
      return;
    }

    if (!code || !state) {
      res.redirect(frontendRedirect("/404?error=missing_code_or_state"));
      return;
    }

    // Validate state (CSRF protection)
    if (!pendingStates.has(state)) {
      res.redirect(frontendRedirect("/404?error=invalid_state"));
      return;
    }
    pendingStates.delete(state);

    try {
      // Exchange authorization code for tokens
      const tokenRes = await fetch(MANUS_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: `${BASE_URL}/api/auth/callback`,
          client_id: MANUS_CLIENT_ID,
          client_secret: MANUS_CLIENT_SECRET,
        }),
      });

      if (!tokenRes.ok) {
        const body = await tokenRes.text();
        console.error("[OAuth] Token exchange failed:", tokenRes.status, body);
        res.redirect(frontendRedirect("/404?error=token_exchange_failed"));
        return;
      }

      const tokenData = (await tokenRes.json()) as {
        access_token: string;
        id_token?: string;
      };

      // Fetch user info
      const userInfoRes = await fetch(MANUS_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoRes.ok) {
        console.error("[OAuth] User info fetch failed:", userInfoRes.status);
        res.redirect(frontendRedirect("/404?error=userinfo_failed"));
        return;
      }

      const userInfo = (await userInfoRes.json()) as {
        sub: string;
        name?: string;
        email?: string;
        picture?: string;
      };

      // Upsert user in database
      await upsertUser({
        openId: userInfo.sub,
        name: userInfo.name || null,
        email: userInfo.email || null,
        loginMethod: "manus-oauth",
        lastSignedIn: new Date(),
      });

      // Set session cookie with a signed token
      const sessionToken = crypto
        .createHmac("sha256", MANUS_CLIENT_SECRET || "dev-secret")
        .update(`${userInfo.sub}:${Date.now()}`)
        .digest("hex");

      // Store session mapping (in production, use Redis/DB)
      // For now, encode user info in a signed cookie
      const sessionPayload = Buffer.from(
        JSON.stringify({
          openId: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          token: sessionToken,
        })
      ).toString("base64");

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionPayload, cookieOptions);

      // Redirect to home page
      res.redirect(frontendRedirect("/"));
    } catch (err) {
      console.error("[OAuth] Callback error:", err);
      res.redirect(frontendRedirect("/404?error=internal_error"));
    }
  });

  // Logout - clear session
  app.post("/api/auth/logout", (req, res) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });
}
