import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Local preview only");
  const root = path.resolve(".local-review");
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, "admin-ux-"));
  const databasePath = path.join(directory, "preview.db");
  const source = new Database(
    path.resolve(process.argv[2] || "db/philagora.db"),
    { readonly: true, fileMustExist: true },
  );
  await source.backup(databasePath);
  source.close();
  const port = "3500";
  const env = {
    ...process.env,
    DATABASE_PATH: databasePath,
    AGORA_REVIEW_MODE: "admin",
    AGORA_REVIEW_PORT: port,
    AGORA_WORKER_DISABLED: "true",
    ADMIN_PASSWORD: "local-admin-ux-review",
    ANTHROPIC_API_KEY: "placeholder_key_here",
    ANTHROPIC_BASE_URL: "http://127.0.0.1:1",
    BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
    RUN_SEED: "false",
    NEXT_PUBLIC_GA_MEASUREMENT_ID: "",
  };
  fs.writeFileSync(
    path.join(directory, "preview.json"),
    JSON.stringify({ databasePath, baseURL: `http://127.0.0.1:${port}` }),
  );
  console.log(
    `Isolated admin preview: http://127.0.0.1:${port}/admin · password: local-admin-ux-review`,
  );
  console.log(`Working copy: ${databasePath}`);
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ],
    { stdio: "inherit", env, windowsHide: true },
  );
  process.on("SIGINT", () => child.kill());
  process.on("SIGTERM", () => child.kill());
  child.on("exit", (code) => process.exit(code ?? 0));
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
