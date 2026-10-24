// Test environment defaults. A real Postgres test database must be reachable via
// DATABASE_URL (see README/commands). AI is forced off so classification/drafting
// use deterministic fallbacks and never hit the network.
process.env.NODE_ENV = "test";
process.env.AI_ENABLED = "false";
process.env.ANTHROPIC_API_KEY = "";
process.env.JWT_SECRET ??= "test-secret";
process.env.JWT_EXPIRES_IN ??= "1h";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/bookleaf_test?schema=public";
