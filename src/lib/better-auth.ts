import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

/**
 * Keep Better Auth on the same SQLite file as the app without importing
 * our aliased DB bootstrap, which the Better Auth CLI struggles to resolve.
 */
function resolveDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    const resolved = path.resolve(process.env.DATABASE_PATH);
    const dir = path.dirname(resolved);

    if (!fs.existsSync(dir)) {
      return path.join(process.cwd(), "db", "philagora.db");
    }

    return resolved;
  }

  return path.join(process.cwd(), "db", "philagora.db");
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Database(resolveDatabasePath()),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [nextCookies()],
});
