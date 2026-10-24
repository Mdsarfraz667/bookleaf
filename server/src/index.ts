import "dotenv/config";
import { createApp } from "./app";

function requireEnv(name: string): void {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

requireEnv("DATABASE_URL");
requireEnv("JWT_SECRET");

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`BookLeaf server listening on http://localhost:${port}`);
});
