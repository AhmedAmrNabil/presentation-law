# SecDevOps demo: a pipeline that stops vulnerable code

A small Node.js API and a GitHub Actions pipeline that checks every pull request for security problems.
It shows "shift-left" security: mistakes are found in minutes, before the code is merged.

## The three branches

| Branch | What it contains | Pipeline |
|---|---|---|
| `main` | The safe version of the app | All checks pass |
| `vulnerable` | The same features with seven planted vulnerabilities | Checks fail |
| `fix-vulnerabilities` | The vulnerable branch with every problem fixed | All checks pass |

## The pipeline

```
                 pull request or push to main
                              |
  +----------+----------+-----+-----+-----------+--------------+
  |          |          |           |           |              |
Gitleaks   Trivy      Snyk      SonarCloud   Security       Build image
secrets    IaC        SCA       SAST         tests              |
                                                         +------+------+
                                                         |             |
                                                    Trivy image    OWASP ZAP
                                                    CVEs           DAST
                              |
                  all green and on main: publish image to GHCR
```

| Job | Type | Looks for |
|---|---|---|
| Gitleaks | Secret scanning | Keys and passwords written in the code |
| Trivy (config) | IaC scanning | Unsafe Dockerfile and Kubernetes settings |
| Snyk | SCA | Dependencies with known CVEs |
| SonarCloud | SAST | Dangerous code such as `eval` and shell commands. The job fails if the quality gate fails |
| Security tests | Security regression tests | Runs real attacks against the app. Each attack must fail |
| Trivy (image) | Container scanning | CVEs in the image that would be published |
| OWASP ZAP | DAST | Missing security headers in the running app |

All checks run in parallel, so a pull request shows every problem at once. The image is published only from `main` and only when every check passed.

## The planted vulnerabilities and who catches them

| # | Vulnerability | Where | Caught by |
|---|---|---|---|
| 1 | Hardcoded admin API key | `app.js` | Gitleaks, security tests |
| 2 | No security headers, no rate limit | `app.js` | OWASP ZAP, security tests |
| 3 | Outdated lodash with known CVEs | `package.json` | Snyk |
| 4 | Code injection with `eval` | `/add/:a/:b` | SonarCloud, security tests |
| 5 | SQL injection | `/users/:id` | Security tests |
| 6 | Command injection through a shell | `/ping` | SonarCloud, security tests |
| 7 | Root container, privileged pod, host network | `Dockerfile`, `k8s/deployment.yaml` | Trivy |

No single tool catches everything. SQL injection, for example, is caught only by the security tests.

## Try the attacks

Run the vulnerable version on your own computer, bound to localhost only:

```sh
git switch vulnerable
npm ci --ignore-scripts
docker build -t demo-vulnerable .
docker run --rm -p 127.0.0.1:3000:3000 demo-vulnerable
```

| Attack | Vulnerable result | Safe result |
|---|---|---|
| `curl localhost:3000/add/7*7/1` | `{"result":50}`: the input was run as code | `400` |
| `curl localhost:3000/add/process.version/1` | The Node.js version leaks | `400` |
| `curl "localhost:3000/users/1%20OR%201=1"` | All users | `400` |
| `curl "localhost:3000/users/0%20UNION%20SELECT%20name,email%20FROM%20users"` | Every private email | `400` |
| `curl "localhost:3000/ping?host=localhost;id"` | Output of the `id` command | `400` |
| `curl -H "x-api-key: <key from app.js>" localhost:3000/admin/users` | Full user list with emails | `503`, admin is off without a configured key |
| `curl -I localhost:3000/` | `X-Powered-By: Express`, no security headers | Helmet headers |
| `curl localhost:3000/add/abc/1` | `500` with a stack trace | `400` |

Only run these against your own copy. Never expose the vulnerable version to a network.

## Run the tests

```sh
npm ci --ignore-scripts
npm test
```

On `main` all tests pass. On `vulnerable` most of them fail, and each failure names the attack that worked.

## Files

| File | Purpose |
|---|---|
| `app.js` | The application |
| `test/security.test.js` | Security regression tests |
| `Dockerfile` | Multi-stage, non-root container image |
| `k8s/deployment.yaml` | Hardened Kubernetes deployment |
| `.github/workflows/security.yml` | The security pipeline |
| `.zap/rules.tsv` | Which ZAP findings fail the build |
| `sonar-project.properties` | SonarCloud settings |

## Next step for a real project

Make every job a required status check in the branch protection settings of `main`. Until then, a red check warns but does not stop someone from merging.
