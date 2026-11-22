"use strict";

// Security regression tests. Each test is an attack that must fail.
// Run with: npm test

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../app");

let server;
let base;

before(async () => {
  server = createApp({ apiKey: "" }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const get = (path, headers = {}) => fetch(base + path, { headers });

test("calculator still adds numbers", async () => {
  const res = await get("/add/2/3");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { result: 5 });
});

test("calculator does not run code (code injection)", async () => {
  const res = await get("/add/7*7/1");
  assert.equal(res.status, 400, `the input 7*7 was executed: ${await res.text()}`);
});

test("user lookup returns one user", async () => {
  const res = await get("/users/1");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: 1, name: "alice" });
});

test("user lookup cannot dump the table (SQL injection)", async () => {
  const res = await get("/users/1%20OR%201=1");
  assert.equal(res.status, 400, `the query was changed by the input: ${await res.text()}`);
});

test("user lookup cannot read private emails (SQL injection)", async () => {
  const res = await get("/users/0%20UNION%20SELECT%20name,%20email%20FROM%20users");
  const body = await res.text();
  assert.doesNotMatch(body, /@example\.com/, `private emails leaked: ${body}`);
});

test("ping does not run shell commands (command injection)", async () => {
  const res = await get("/ping?host=" + encodeURIComponent("localhost | echo INJECTED"));
  const body = await res.text();
  assert.doesNotMatch(body, /INJECTED/, `the injected command ran: ${body}`);
  assert.equal(res.status, 400);
});

test("ping accepts a normal hostname", async () => {
  const res = await get("/ping?host=localhost");
  assert.equal(res.status, 200);
});

test("admin is disabled when no key is configured (hardcoded secret)", async () => {
  const res = await get("/admin/users", { "x-api-key": "guess" });
  assert.equal(res.status, 503, "admin accepted requests although no key was configured");
});

test("responses carry security headers", async () => {
  const res = await get("/");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.ok(res.headers.get("content-security-policy"), "Content-Security-Policy is missing");
  assert.equal(res.headers.get("x-powered-by"), null, "X-Powered-By reveals the framework");
});

test("too many requests are rejected (rate limiting)", async () => {
  const limited = createApp({ requestsPerMinute: 3 }).listen(0, "127.0.0.1");
  await new Promise((resolve) => limited.once("listening", resolve));
  try {
    const url = `http://127.0.0.1:${limited.address().port}/health`;
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await fetch(url)).status);
    assert.deepEqual(codes, [200, 200, 200, 429]);
  } finally {
    limited.close();
  }
});
