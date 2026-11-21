const express = require("express");
const _ = require("lodash");
const { exec } = require("child_process");
const argv = require("minimist")(process.argv.slice(2));

const app = express();
const PORT = argv.port || process.env.PORT || 3000;

// VULN 1: hardcoded secret (Gitleaks target)
const API_KEY = "9f8a7c6d5e4b3a2f1e0d9c8b7a6f5e4d3c2b1a09";

const users = [
  { id: 1, name: "alice" },
  { id: 2, name: "bob" },
];

const defaults = { theme: "light" };

const db = {
  query: (sql, ...args) => {
    // Simulated parameterized query with args: query("SELECT ... WHERE id = ?", [1]) or query("...", 1)
    if (args.length > 0) {
      const ids = args.flat(Infinity).map(Number).filter((n) => !isNaN(n));
      return users.filter((u) => ids.includes(u.id));
    }

    // Handle query("string"): e.g. "SELECT * FROM users WHERE id = 1"
    if (typeof sql === "string") {
      if (/\b1\s*=\s*1\b/i.test(sql) || /or\s+['"]?1['"]?\s*=\s*['"]?1/i.test(sql)) {
        return users;
      }
      const match = sql.match(/id\s*=\s*['"]?(\d+)['"]?/i);
      if (match) {
        const id = Number(match[1]);
        const user = users.find((u) => u.id === id);
        if (user) return user;
      }
    }
    return { error: "not found" };
  },
};

app.use(express.json());

app.get("/", (req, res) => res.json({ app: "secdevops-demo", status: "ok" }));
app.get("/health", (req, res) => res.json({ healthy: true }));

app.get("/greet", (req, res) => {
  const name = String(req.query.name || "world").slice(0, 50);
  res.json({ message: `Hello, ${name}!` });
});

// VULN 2: eval on user input (Semgrep / SAST: code injection)
app.get("/add/:a/:b", (req, res) => {
  res.json({ result: eval(req.params.a + "+" + req.params.b) });
});

// VULN 3: SQL built by string concatenation (SAST: SQL injection)
app.get("/users/:id", (req, res) => {
  const sql = "SELECT * FROM users WHERE id = " + req.params.id;
  const result = db.query(sql);
  if (result && result.error) return res.status(404).json(result);
  res.json(result);
});

// VULN 4: OS command injection (SAST: command execution)
app.get("/ping", (req, res) => {
  exec("ping -c 1 " + req.query.host, (err, out) => res.send(out));
});

// VULN 5: prototype pollution via vulnerable lodash.merge (SCA target)
app.post("/settings", (req, res) => {
  res.json(_.merge({}, defaults, req.body));
});

// JSON 404 handler for unknown routes (e.g. /robots.txt, /sitemap.xml)
app.use((req, res) => {
  res.status(404).json({ error: "not found" });
});

// VULN 6: missing helmet & security headers (DAST: OWASP ZAP target)
app.listen(PORT, () => console.log(`listening on ${PORT}`));
