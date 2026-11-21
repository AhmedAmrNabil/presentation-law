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

// Security headers with strict CSP (all directives have explicit fallbacks)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
  })
);

// Prevent caching of sensitive data & set permissions policy
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  next();
});

app.use(rateLimit({ windowMs: 60_000, limit: 100 })); // basic rate limiting
app.use(express.json());

app.get("/", (req, res) => res.json({ app: "secdevops-demo", status: "ok" }));
app.get("/health", (req, res) => res.json({ healthy: true }));

app.get("/greet", (req, res) => {
  const name = String(req.query.name || "world").slice(0, 50);
  res.json({ message: `Hello, ${name}!` });
});

app.get("/users/:id", (req, res) => {
  const id = Number.parseInt(req.params.id, 10); // validated input
  const user = users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: "not found" });
  res.json(user);
});

// JSON 404 handler for unknown routes (e.g. /robots.txt, /sitemap.xml)
app.use((req, res) => {
  res.status(404).json({ error: "not found" });
});

app.listen(PORT, () => console.log(`listening on ${PORT}`));
