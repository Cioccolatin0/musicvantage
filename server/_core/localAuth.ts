import crypto from "crypto";
import { query, queryOne, run } from "./pg";

type StoredUser = {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

type InviteCode = {
  code: string;
  usedBy?: string;
  usedAt?: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
};

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, s, 64).toString("hex");
  return { hash, salt: s };
}

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function mapUserRow(r: any): StoredUser {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    passwordHash: r.password_hash,
    salt: r.salt,
    createdAt: typeof r.created_at === "object" ? r.created_at.toISOString() : r.created_at,
  };
}

function mapCodeRow(r: any): InviteCode {
  return {
    code: r.code,
    usedBy: r.used_by || undefined,
    usedAt: r.used_at ? (typeof r.used_at === "object" ? r.used_at.toISOString() : r.used_at) : undefined,
    createdBy: r.created_by,
    createdAt: typeof r.created_at === "object" ? r.created_at.toISOString() : r.created_at,
    expiresAt: r.expires_at ? (typeof r.expires_at === "object" ? r.expires_at.toISOString() : r.expires_at) : undefined,
  };
}

export async function getUsers(): Promise<StoredUser[]> {
  try {
    const rows = await query('SELECT * FROM "localUsers" ORDER BY id');
    return rows.map(mapUserRow);
  } catch (error) {
    console.error("[localAuth] getUsers failed:", error);
    return [];
  }
}

export async function getInviteCodes(): Promise<InviteCode[]> {
  try {
    const rows = await query('SELECT * FROM "inviteCodes" ORDER BY id');
    return rows.map(mapCodeRow);
  } catch (error) {
    console.error("[localAuth] getInviteCodes failed:", error);
    return [];
  }
}

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  try {
    const row = await queryOne('SELECT * FROM "localUsers" WHERE email = $1 LIMIT 1', [email]);
    return row ? mapUserRow(row) : undefined;
  } catch (error) {
    console.error("[localAuth] findUserByEmail failed:", error);
    return undefined;
  }
}

export async function findUserById(id: number): Promise<StoredUser | undefined> {
  try {
    const row = await queryOne('SELECT * FROM "localUsers" WHERE id = $1 LIMIT 1', [id]);
    return row ? mapUserRow(row) : undefined;
  } catch (error) {
    console.error("[localAuth] findUserById failed:", error);
    return undefined;
  }
}

export async function registerUser(email: string, name: string, password: string, inviteCode: string): Promise<StoredUser> {
  const codes = await getInviteCodes();
  const invite = codes.find((c) => c.code === inviteCode && !c.usedBy);

  if (!invite) throw new Error("Codice invito non valido o già utilizzato");
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    throw new Error("Codice invito scaduto");
  }

  const existing = await findUserByEmail(email);
  if (existing) throw new Error("Email già registrata");

  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();

  const result = await run(
    'INSERT INTO "localUsers" (email, name, password_hash, salt, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [email, name, hash, salt, now]
  );

  const row = result.rows?.[0];
  const user: StoredUser = {
    id: row?.id || 0,
    email,
    name,
    passwordHash: hash,
    salt,
    createdAt: now,
  };

  await run(
    'UPDATE "inviteCodes" SET used_by = $1, used_at = $2 WHERE code = $3',
    [email, now, inviteCode]
  );

  return user;
}

export async function loginUser(email: string, password: string): Promise<StoredUser> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("Email o password non validi");

  const { hash } = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    throw new Error("Email o password non validi");
  }

  return user;
}

export async function validateInviteCode(code: string): Promise<{ valid: boolean; message?: string }> {
  const codes = await getInviteCodes();
  const invite = codes.find((c) => c.code === code);

  if (!invite) return { valid: false, message: "Codice invito non valido" };
  if (invite.usedBy) return { valid: false, message: "Codice invito già utilizzato" };
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return { valid: false, message: "Codice invito scaduto" };
  }

  return { valid: true };
}

export async function generateInviteCode(createdBy: string, expiresInDays?: number): Promise<InviteCode | null> {
  const code = generateCode();
  const now = new Date().toISOString();

  let expiresAt: string | null = null;
  if (expiresInDays && expiresInDays > 0) {
    const exp = new Date();
    exp.setDate(exp.getDate() + expiresInDays);
    expiresAt = exp.toISOString();
  }

  try {
    await run(
      'INSERT INTO "inviteCodes" (code, created_by, expires_at) VALUES ($1, $2, $3)',
      [code, createdBy, expiresAt]
    );
    return {
      code,
      createdBy,
      createdAt: now,
      expiresAt: expiresAt || undefined,
    };
  } catch (error) {
    console.error("[localAuth] generateInviteCode failed:", error);
  }

  return null;
}

export async function getSessionUser(email: string): Promise<{ id: number; email: string; name: string } | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}
