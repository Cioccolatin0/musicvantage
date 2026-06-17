import crypto from "crypto";
import { Pool } from "pg";

let _pool: Pool | null = null;

function getPool(): Pool | null {
  if (_pool) return _pool;
  if (!process.env.DATABASE_URL) return null;
  _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

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

export async function getUsers(): Promise<StoredUser[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const result = await pool.query('SELECT * FROM "localUsers" ORDER BY id');
    return result.rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      passwordHash: r.passwordHash,
      salt: r.salt,
      createdAt: r.createdAt?.toISOString?.() || r.createdAt,
    }));
  } catch (error) {
    console.error("[localAuth] Failed to get users:", error);
    return [];
  }
}

export async function getInviteCodes(): Promise<InviteCode[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const result = await pool.query('SELECT * FROM "inviteCodes" ORDER BY id');
    return result.rows.map((r) => ({
      code: r.code,
      usedBy: r.usedBy || undefined,
      usedAt: r.usedAt?.toISOString?.() || r.usedAt || undefined,
      createdBy: r.createdBy,
      createdAt: r.createdAt?.toISOString?.() || r.createdAt,
      expiresAt: r.expiresAt?.toISOString?.() || r.expiresAt || undefined,
    }));
  } catch (error) {
    console.error("[localAuth] Failed to get invite codes:", error);
    return [];
  }
}

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  const pool = getPool();
  if (!pool) return undefined;
  try {
    const result = await pool.query('SELECT * FROM "localUsers" WHERE email = $1 LIMIT 1', [email]);
    if (result.rows.length === 0) return undefined;
    const r = result.rows[0];
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      passwordHash: r.passwordHash,
      salt: r.salt,
      createdAt: r.createdAt?.toISOString?.() || r.createdAt,
    };
  } catch (error) {
    console.error("[localAuth] Failed to find user by email:", error);
    return undefined;
  }
}

export async function findUserById(id: number): Promise<StoredUser | undefined> {
  const pool = getPool();
  if (!pool) return undefined;
  try {
    const result = await pool.query('SELECT * FROM "localUsers" WHERE id = $1 LIMIT 1', [id]);
    if (result.rows.length === 0) return undefined;
    const r = result.rows[0];
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      passwordHash: r.passwordHash,
      salt: r.salt,
      createdAt: r.createdAt?.toISOString?.() || r.createdAt,
    };
  } catch (error) {
    console.error("[localAuth] Failed to find user by id:", error);
    return undefined;
  }
}

export async function registerUser(email: string, name: string, password: string, inviteCode: string): Promise<StoredUser> {
  const pool = getPool();
  if (!pool) throw new Error("Database non disponibile");

  const codes = await getInviteCodes();
  const invite = codes.find((c) => c.code === inviteCode && !c.usedBy);

  if (!invite) {
    throw new Error("Codice invito non valido o già utilizzato");
  }

  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    throw new Error("Codice invito scaduto");
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("Email già registrata");
  }

  const { hash, salt } = hashPassword(password);

  const result = await pool.query(
    'INSERT INTO "localUsers" (email, name, passwordHash, salt) VALUES ($1, $2, $3, $4) RETURNING id, email, name, createdAt',
    [email, name, hash, salt]
  );

  const row = result.rows[0];
  const user: StoredUser = {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: hash,
    salt,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
  };

  await pool.query(
    'UPDATE "inviteCodes" SET "usedBy" = $1, "usedAt" = now() WHERE code = $2',
    [email, inviteCode]
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

export async function generateInviteCode(createdBy: string, expiresInDays?: number): Promise<InviteCode> {
  const pool = getPool();
  if (!pool) throw new Error("Database non disponibile");

  const code = generateCode();

  let expiresAt: string | null = null;
  if (expiresInDays && expiresInDays > 0) {
    const exp = new Date();
    exp.setDate(exp.getDate() + expiresInDays);
    expiresAt = exp.toISOString();
  }

  await pool.query(
    'INSERT INTO "inviteCodes" (code, "createdBy", "expiresAt") VALUES ($1, $2, $3)',
    [code, createdBy, expiresAt]
  );

  return {
    code,
    createdBy,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt || undefined,
  };
}

export async function getSessionUser(email: string): Promise<{ id: number; email: string; name: string } | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}
