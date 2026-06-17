import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INVITES_FILE = path.join(__dirname, "../../invite_codes.json");
const USERS_FILE = path.join(__dirname, "../../users.json");

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

function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    }
  } catch {}
  return fallback;
}

function writeJson(file: string, data: unknown) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function getUsers(): StoredUser[] {
  return readJson<StoredUser[]>(USERS_FILE, []);
}

function saveUsers(users: StoredUser[]) {
  writeJson(USERS_FILE, users);
}

export function getInviteCodes(): InviteCode[] {
  return readJson<InviteCode[]>(INVITES_FILE, []);
}

function saveInviteCodes(codes: InviteCode[]) {
  writeJson(INVITES_FILE, codes);
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, s, 64).toString("hex");
  return { hash, salt: s };
}

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export function findUserByEmail(email: string): StoredUser | undefined {
  return getUsers().find((u) => u.email === email);
}

export function findUserById(id: number): StoredUser | undefined {
  return getUsers().find((u) => u.id === id);
}

export function registerUser(email: string, name: string, password: string, inviteCode: string): StoredUser {
  const codes = getInviteCodes();
  const invite = codes.find((c) => c.code === inviteCode && !c.usedBy);

  if (!invite) {
    throw new Error("Codice invito non valido o già utilizzato");
  }

  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    throw new Error("Codice invito scaduto");
  }

  if (findUserByEmail(email)) {
    throw new Error("Email già registrata");
  }

  const users = getUsers();
  const maxId = users.length > 0 ? Math.max(...users.map((u) => u.id)) : 0;
  const { hash, salt } = hashPassword(password);

  const user: StoredUser = {
    id: maxId + 1,
    email,
    name,
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  saveUsers(users);

  invite.usedBy = email;
  invite.usedAt = new Date().toISOString();
  saveInviteCodes(codes);

  return user;
}

export function loginUser(email: string, password: string): StoredUser {
  const user = findUserByEmail(email);
  if (!user) throw new Error("Email o password non validi");

  const { hash } = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    throw new Error("Email o password non validi");
  }

  return user;
}

export function validateInviteCode(code: string): { valid: boolean; message?: string } {
  const codes = getInviteCodes();
  const invite = codes.find((c) => c.code === code);

  if (!invite) return { valid: false, message: "Codice invito non valido" };
  if (invite.usedBy) return { valid: false, message: "Codice invito già utilizzato" };
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return { valid: false, message: "Codice invito scaduto" };
  }

  return { valid: true };
}

export function generateInviteCode(createdBy: string, expiresInDays?: number): InviteCode {
  const codes = getInviteCodes();
  const code: InviteCode = {
    code: generateCode(),
    createdBy,
    createdAt: new Date().toISOString(),
  };

  if (expiresInDays && expiresInDays > 0) {
    const exp = new Date();
    exp.setDate(exp.getDate() + expiresInDays);
    code.expiresAt = exp.toISOString();
  }

  codes.push(code);
  saveInviteCodes(codes);
  return code;
}

export function getSessionUser(email: string): { id: number; email: string; name: string } | null {
  const user = findUserByEmail(email);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}
