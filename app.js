"use strict";

const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const { DatabaseSync } = require("node:sqlite");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// A small in-memory database. Emails are private: only the admin endpoint may show them.
function createDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL);
    INSERT INTO users (id, name, email) VALUES
      (1, 'alice', 'alice@example.com'),
      (2, 'bob',   'bob@example.com'),
      (3, 'carol', 'carol@example.com');
  `);
  return db;
}

// Compare secrets in constant time, so the response time does not reveal how much of the key was right
function sameSecret(given, expected) {
  const digest = (value) => crypto.createHash("sha256").update(String(value)).digest();
  return crypto.timingSafeEqual(digest(given), digest(expected));
}

// A hostname is dot-separated labels of letters, digits and inner hyphens
function isHostname(value) {
  if (value.length === 0 || value.length > 253) return false;
  return value.split(".").every((label) => /^[a-z0-9-]{1,63}$/i.test(label) && !label.startsWith("-") && !label.endsWith("-"));
}

function createApp({ apiKey = process.env.API_KEY, requestsPerMinute = 100 } = {}) {
  const app = express();
  const db = createDatabase();
  const findUser = db.prepare("SELECT id, name FROM users WHERE id = ?");
  const allUsers = db.prepare("SELECT id, name, email FROM users");

  app.use(helmet()); // security headers, and no X-Powered-By
  app.use(rateLimit({ windowMs: 60_000, limit: requestsPerMinute, standardHeaders: "draft-8", legacyHeaders: false }));
  app.use(express.json());

  app.get("/", (req, res) => res.json({ app: "secdevops-demo", status: "ok" }));
  app.get("/health", (req, res) => res.json({ healthy: true }));

  app.get("/greet", (req, res) => {
    const name = String(req.query.name || "world").slice(0, 50);
    res.json({ message: `Hello, ${name}!` });
  });

  // Calculator: the inputs must be numbers, nothing is executed
  app.get("/add/:a/:b", (req, res) => {
    const a = Number(req.params.a);
    const b = Number(req.params.b);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return res.status(400).json({ error: "a and b must be numbers" });
    }
    res.json({ result: a + b });
  });

  // User lookup: the ID must be digits, and it is sent to the database separately from the SQL
  app.get("/users/:id", (req, res) => {
    if (!/^\d{1,9}$/.test(req.params.id)) {
      return res.status(400).json({ error: "id must be a number" });
    }
    const user = findUser.get(Number(req.params.id));
    if (!user) return res.status(404).json({ error: "not found" });
    res.json(user);
  });

  // Host check: no shell and no external program, just a DNS lookup of a valid hostname
  app.get("/ping", async (req, res) => {
    const host = String(req.query.host || "");
    if (!isHostname(host)) return res.status(400).json({ error: "invalid host" });
    try {
      const { address } = await dns.lookup(host);
      res.json({ host, address });
    } catch {
      res.status(404).json({ error: "host not found" });
    }
  });

  // Admin: the key comes from the environment. Without one, the endpoint is switched off.
  app.get("/admin/users", (req, res) => {
    if (!apiKey) return res.status(503).json({ error: "admin is disabled" });
    if (!sameSecret(req.get("x-api-key") || "", apiKey)) {
      return res.status(401).json({ error: "invalid api key" });
    }
    res.json(allUsers.all());
  });

  app.use((req, res) => res.status(404).json({ error: "not found" }));

  // Never send stack traces to the client
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  });

  return app;
}

module.exports = { createApp };

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => console.log(`listening on ${port}`));
}
