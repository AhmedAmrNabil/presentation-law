# SecDevOps GitHub Actions Demo

This repository demonstrates an automated DevSecOps CI/CD pipeline integrated with GitHub Actions. It implements the "Shift-Left" security model by executing continuous security gates directly on pull requests.

## Architecture & Security Gates

```
                      ┌──────────────────────────────────────────┐
                      │          GitHub Pull Request             │
                      └────────────────────┬─────────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                             │
             ┌──────▼──────┐                               ┌──────▼──────┐
             │ Pre-Build   │                               │ Build / Post│
             └──────┬──────┘                               └──────┬──────┘
                    │                                             │
      ┌─────────────┼─────────────┐                 ┌─────────────┼─────────────┐
      │             │             │                 │             │             │
┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐     ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
│ Gitleaks  │ │ npm audit │ │  Semgrep  │     │ Hadolint  │ │  Trivy    │ │ OWASP ZAP │
│ (Secrets) │ │   (SCA)   │ │  (SAST)   │     │(Dockerfile│ │(Image+IaC)│ │  (DAST)   │
└───────────┘ └───────────┘ └───────────┘     └───────────┘ └───────────┘ └───────────┘
```

1. **Secret Scanning (Gitleaks):** Prevents exposed credentials and API keys from leaking into version control.
2. **Software Composition Analysis (SCA - npm audit & Dependency Review):** Detects vulnerable open-source dependencies (e.g. prototype pollution, code injection).
3. **Static Application Security Testing (SAST - Semgrep):** Detects code execution (`eval`), SQL injection, and insecure patterns directly in source code.
4. **Container & Infrastructure as Code Hardening (Hadolint & Trivy):** Lints Dockerfile for production best practices and audits Kubernetes manifests for privilege escalation and missing isolation.
5. **Container Vulnerability Scanning (Trivy):** Scans the built container image for known OS-level CVEs.
6. **Dynamic Application Security Testing (DAST - OWASP ZAP):** Performs automated dynamic security testing against the active staging service.

---

## Branches

- `main`: **Production-ready, hardened baseline.** All automated security checks pass 🟢.
- `vulnerable`: **Demonstration branch.** Introduces OWASP Top 10 vulnerabilities, bad Dockerfile practices, and insecure Kubernetes manifests to trigger automated pipeline failures 🔴.

---

## Live Demo Walkthrough (Team 5)

1. **Baseline Health Check (Slides 32–33):**
   * Inspect the **Actions** tab on `main`. All 6 security jobs run and pass green 🟢.
2. **Opening the Pull Request (Slide 34):**
   * Create a Pull Request comparing `main` $\leftarrow$ `vulnerable`.
   * GitHub Actions triggers automatically.
3. **Automated Security Gates in Action (Slide 35):**
   * Review the failing checks:
     * **Gitleaks** blocks the PR due to hardcoded `API_KEY`.
     * **npm audit** flags High/Critical CVEs in `lodash` and `minimist`.
     * **Semgrep** blocks `eval()` code injection and raw SQL string concat.
     * **Hadolint** blocks unpinned `node:latest` and root user execution.
     * **Trivy** flags Kubernetes `privileged: true` and `hostNetwork: true`.
4. **Takeaway:**
   * Security gates automatically block non-compliant code before deployment, achieving true **Shift-Left Security**.


falco kubernetes, sonar cube, hashicorp vault, checkov, snyk, owasp zap