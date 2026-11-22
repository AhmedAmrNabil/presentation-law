const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY; // secrets come from the environment

const users = [
  { id: 1, name: "alice" },
  { id: 2, name: "bob" },
];

const db = {
  query: (sql, ...args) => {
    if (args.length > 0) {
      const ids = args.flat(Infinity).map(Number).filter((n) => !isNaN(n));
      return users.filter((u) => ids.includes(u.id));
    }
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

app.use(helmet());

app.use(rateLimit({ windowMs: 60_000, limit: 100 })); // basic rate limiting
app.use(express.json());

app.get("/", (req, res) => res.json({ app: "secdevops-demo", status: "ok" }));
app.get("/health", (req, res) => res.json({ healthy: true }));

app.get("/greet", (req, res) => {
  const name = String(req.query.name || "world").slice(0, 50);
  res.json({ message: `Hello, ${name}!` });
});

// Add endpoint: validates numbers and computes sum without eval
app.get("/add/:a/:b", (req, res) => {
  const a = Number(req.params.a);
  const b = Number(req.params.b);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return res.status(400).json({ error: "both a and b must be numbers" });
  }
  res.json({ result: a + b });
});

app.get("/users/:id", (req, res) => {
  const id = Number.parseInt(req.params.id, 10); // validated input
  const result = db.query("SELECT * FROM users WHERE id = ?", [id]);
  if (!result || result.length === 0) return res.status(404).json({ error: "not found" });
  res.json(result[0]);
});

// JSON 404 handler for unknown routes (e.g. /robots.txt, /sitemap.xml)
app.use((req, res) => {
  res.status(404).json({ error: "not found" });
});

app.listen(PORT, () => console.log(`listening on ${PORT}`));
