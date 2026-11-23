"use strict";

const { exec } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const express = require("express");
const _ = require("lodash");

// VULNERABILITY 1: hardcoded secret. Anyone who can read the repository can use the admin endpoint.
const API_KEY = "adm_7Fq2Lx9Rv4Tb8Np1Wz6Ke3Hc5Mj0Ys";

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

// The options are accepted but ignored: there is no rate limit and the key is hardcoded
function createApp() {
  const app = express();
  const db = createDatabase();

  // VULNERABILITY 2: no Helmet and no rate limiter, so no security headers and unlimited requests
  app.use(express.json());

  app.get("/", (req, res) => res.json({ app: "secdevops-demo", status: "ok" }));
  app.get("/health", (req, res) => res.json({ healthy: true }));

  // VULNERABILITY 3: outdated dependency. lodash 4.17.15 has known high-severity CVEs.
  app.get("/greet", (req, res) => {
    const name = _.capitalize(String(req.query.name || "world").slice(0, 50));
    res.json({ message: `Hello, ${name}!` });
  });

  // VULNERABILITY 4: code injection. eval runs whatever is in the URL as JavaScript.
  app.get("/add/:a/:b", (req, res) => {
    res.json({ result: eval(req.params.a + "+" + req.params.b) });
  });

  // VULNERABILITY 5: SQL injection. The ID is pasted into the SQL text.
  app.get("/users/:id", (req, res) => {
    const rows = db.prepare("SELECT id, name FROM users WHERE id = " + req.params.id).all();
    if (rows.length === 0) return res.status(404).json({ error: "not found" });
    res.json(rows.length === 1 ? rows[0] : rows);
  });

  // VULNERABILITY 6: command injection. The host is pasted into a shell command.
  app.get("/ping", (req, res) => {
    exec("ping -c 1 " + req.query.host, (err, stdout, stderr) => res.type("text").send(stdout + stderr));
  });

  app.get("/admin/users", (req, res) => {
    if (req.get("x-api-key") !== API_KEY) return res.status(401).json({ error: "invalid api key" });
    res.json(db.prepare("SELECT id, name, email FROM users").all());
  });

  app.use((req, res) => res.status(404).json({ error: "not found" }));

  return app;
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => console.log(`listening on port ${port}`));
}

module.exports = { createApp };
