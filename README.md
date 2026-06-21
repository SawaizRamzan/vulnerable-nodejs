# Vulnerable Node.js — Cybersecurity Internship Project

A deliberately vulnerable Node.js web application secured as part of a 3-week cybersecurity internship.

## Tech Stack
- Node.js, Express.js, MongoDB
- Helmet.js, bcrypt, jsonwebtoken, validator.js, Winston

## Week 1 — Vulnerability Identification
- No input validation on user-facing forms
- Passwords stored in plaintext
- No HTTP security headers
- No authentication system
- Admin and user routes publicly accessible
- 45 known npm dependency vulnerabilities

## Week 2 — Security Hardening

| Fix | Tool |
|-----|------|
| Input validation | validator.js |
| Password hashing | bcrypt |
| JWT authentication | jsonwebtoken |
| HTTP security headers | Helmet.js |

## Week 3 — Penetration Testing & Logging

### Nmap Scan
- Port 3000: Node.js app running with all Helmet.js headers confirmed
- Vuln script scan: No known CVEs detected on port 3000

### Manual Attack Simulations

| Attack | Result |
|--------|--------|
| SQL Injection | Blocked |
| NoSQL Injection ($gt operator) | Vulnerable — login bypassed |
| Unauthenticated /admin access | Vulnerable |
| Unauthenticated /users/userlist | Vulnerable — user data exposed |

### npm Dependency Audit

| Severity | Before | After fix |
|----------|--------|-----------|
| Critical | 7 | 3 |
| High | 23 | 14 |
| Moderate | 7 | 5 |
| Low | 8 | 6 |
| Total | 45 | 28 |

## Setup
```bash
npm install
npm start
```
App runs on http://localhost:3000

## References
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Helmet.js](https://helmetjs.github.io/)
- [Winston](https://github.com/winstonjs/winston)
- [Nmap](https://nmap.org)

## Author
**Sawaiz Ramzan** — Cybersecurity Internship 2026
