import { inferAsyncReturnType } from "@trpc/server";
import { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getUserByOpenId } from "../../db";
import { getSessionFromCookie } from "./cookies";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const user = await getSessionFromCookie(req);

  return {
    req,
    res,
    user,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
