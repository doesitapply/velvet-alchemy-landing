import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user;
  // MOCK USER FOR EXPLORATION
  user = {
    id: 1,
    openId: "dev-user",
    name: "Architect Cameron",
    email: "cameron@velvet-alchemy.com",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    loginMethod: "mock"
  } as any;

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
