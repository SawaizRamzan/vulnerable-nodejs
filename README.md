# Vulnerable Node.js — Security Hardening Project

A deliberately vulnerable Node.js web application secured as part of a cybersecurity internship (Weeks 1–6). This project demonstrates real-world security vulnerabilities and the process of identifying, exploiting, and remediating them.

---

## Project Structure

```
vulnerable-nodejs/
├── app.js              # Main application (security middleware configured here)
├── logger.js           # Winston logging configuration
├── security.log        # Runtime security log (auto-generated)
├── routes/
│   ├── users.js        # User management routes (auth, JWT, rate limiting)
│   ├── admin.js        # Admin panel routes
│   └── index.js        # Login routes
├── views/              # Jade templates
└── public/             # Static assets
```

---

## Branches

| Branch | Description |
|--------|-------------|
| `master` | Original vulnerable application — untouched |
| `internship` | All security fixes applied (Phase 1 + Phase 2) |

Use `master` vs `internship` diff to see every security change made.

**Tag:** `phase-1-complete` marks the end of Phase 1 (Weeks 1–3) on the internship branch.

---

## Phase 1 — Security Assessment & Basic Hardening (Weeks 1–3)

### Week 1: Vulnerability Assessment

Identified vulnerabilities through manual testing and OWASP ZAP automated scanning.

**Manual Testing Findings:**
- NoSQL Injection via login bypass (`{"$gt": ""}`)
- Broken Access Control — unauthenticated admin panel access
- Plain-text password storage in MongoDB
- No session management or token expiry
- Missing HTTP security headers
- Verbose error messages exposing stack traces

**OWASP ZAP Scan Findings (11 alerts):**
- Missing Content Security Policy header
- Missing Anti-clickjacking header
- Sub Resource Integrity attribute missing
- Cookie without SameSite attribute
- X-Content-Type-Options header missing
- Server leaking version via X-Powered-By header

### Week 2: Security Fixes Implemented

**1. Password Hashing with bcrypt**
```javascript
const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash(password, 10);
```
Passwords are now hashed with salt rounds of 10 before storage. Plain-text passwords eliminated.

**2. JWT Authentication**
```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
```
Session-based auth replaced with stateless JWT tokens. Tokens expire after 1 hour.

**3. Input Validation & Sanitization**
```javascript
const validator = require('validator');
if (!validator.isEmail(email)) { return res.status(400).send('Invalid email'); }
```
All user inputs validated and sanitized before processing.

**4. Security Headers with Helmet.js**
```javascript
const helmet = require('helmet');
app.use(helmet());
```
Added X-Frame-Options, X-Content-Type-Options, and other security headers.

### Week 3: Logging & Dependency Audit

**Winston Logging**
```javascript
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'security.log' })
  ]
});
logger.info('Application started');
```
All application events logged to both console and `security.log` file.

**npm audit Results**
- 45 vulnerabilities identified (8 low, 7 moderate, 21 high, 6 critical)
- Legacy dependencies flagged for upgrade

---

## Phase 2 — Advanced Security (Weeks 4–6)

### 1. Intrusion Detection & Monitoring — Fail2Ban

Configured Fail2Ban on Kali Linux to monitor the web application's failed login attempts and automatically ban attackers.

**Custom Filter (`/etc/fail2ban/filter.d/nodejs-auth.conf`):**
```ini
[Definition]
failregex = Failed login attempt for user: .* from IP: <HOST> - Total attempts:
ignoreregex =
```

This regex parses the Winston JSON logs and extracts the attacker's IP address on each failed login.

**Jail Configuration (`/etc/fail2ban/jail.local`):**
```ini
[nodejs-auth]
enabled    = true
filter     = nodejs-auth
logpath    = /home/savez/vulnerable-nodejs/security.log
maxretry   = 3
bantime    = 300
findtime   = 60
backend    = polling
ignoreip   =
ignoreself = false
```

**Behaviour:** After 3 failed login attempts within 60 seconds, the attacker's IP is automatically banned for 5 minutes via firewall rules.

**Test result:** After 4 failed login attempts, both `127.0.0.1` (Kali browser) and `192.168.64.1` (Mac IP) were successfully detected and banned. Verified with `fail2ban-client status nodejs-auth`, then manually unbanned with `fail2ban-client set nodejs-auth unbanip`.

### 2. API Security Hardening

**Rate Limiting**
```javascript
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again after 15 minutes.',
});
app.use('/users/session', loginLimiter);
```
Login endpoint limited to 10 requests per 15 minutes per IP.

**CORS Configuration**
```javascript
const corsOptions = {
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
```
Only requests from `localhost:3000` are accepted. Cross-origin requests from other domains are blocked.

**JWT API Protection**
API routes protected with JWT middleware. Requests without a valid Bearer token receive a 401 Unauthorized response.

**Failed Login Detection**
```javascript
function trackFailedLogin(username) {
  // Logs alert after 3 failures, locks account after 5
}
```
Application-level brute force detection independent of Fail2Ban.

### 3. Security Headers & CSP

**Content Security Policy (CSP)**
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

**Verified Response Headers:**
| Header | Value | Purpose |
|--------|-------|---------|
| `content-security-policy` | default-src 'self'; ... | Prevents XSS |
| `strict-transport-security` | max-age=31536000; includeSubDomains; preload | Enforces HTTPS |
| `x-frame-options` | SAMEORIGIN | Prevents clickjacking |
| `x-content-type-options` | nosniff | Prevents MIME sniffing |
| `referrer-policy` | no-referrer | Hides referrer info |
| `access-control-allow-origin` | http://localhost:3000 | CORS enforcement |

---

### Week 5: Ethical Hacking & Vulnerability Fixes

Four High-severity vulnerabilities were identified through manual testing with Burp Suite and SQLMap, then remediated.

**1. NoSQL Injection (Authentication Bypass)**

The original login route passed user input directly into MongoDB queries. An attacker could send `{"$gt": ""}` as the username to bypass authentication entirely.

```javascript
// Fix: validate that inputs are strings, not objects
if (typeof username !== 'string' || typeof password !== 'string') {
  return res.status(400).send({ msg: 'Invalid input' });
}
```

**2. Cross-Site Request Forgery (CSRF)**

The app had no CSRF protection. Any external website could forge requests on behalf of a logged-in user. Fixed using `csurf` middleware.

```javascript
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });
app.use(csrfProtection);
app.use(function(req, res, next) {
  res.locals.csrfToken = req.csrfToken();
  next();
});
```

Every state-changing request now requires a valid `X-CSRF-Token` header or the server returns 403 Forbidden.

**3. Mass Assignment (Privilege Escalation)**

The `/users/modify` endpoint passed `req.body` directly to MongoDB, allowing attackers to overwrite any field including `admin` status. Fixed with a field whitelist.

```javascript
const allowedFields = ['email', 'fullname', 'age', 'location', 'card'];
const updateData = {};
allowedFields.forEach(field => {
  if (req.body[field] !== undefined) updateData[field] = req.body[field];
});
await collection.update({ _id: req.session.user._id }, { $set: updateData });
```

**4. JWT Token Without Expiry**

JWT tokens were issued with no expiry, meaning stolen tokens were valid forever. Fixed by adding a 1-hour expiry.

```javascript
var token = jwt.sign(
  { id: user._id },
  process.env.TOKEN_SECRET,
  { expiresIn: '1h' }
);
```

**SQLMap Scan Result:** No SQL injection vulnerabilities found (application uses MongoDB). Rate limiting and CSRF protections were triggered during the scan, confirming they work against automated tools.

---

### Week 6: Security Audits, Dependency Scanning & Final Hardening

**OWASP ZAP (3 scans)**
- Found: CSP `unsafe-inline`, jQuery loaded from CDN without SRI, session cookie missing `SameSite`, cross-domain JS
- Fixed: Added `sameSite: 'strict'` and `httpOnly: true` to session cookie; downloaded jQuery 3.7.1 locally; removed Google CDN from CSP
- Result: Medium issues reduced from 2 to 1 (remaining `style-src unsafe-inline` is an accepted risk due to inline SVG in templates)

**Nikto**
- Found: `Permissions-Policy` header missing
- Fixed: Added middleware setting `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`

**Lynis (Hardening Index: 62/100)**
- Critical finding: MongoDB had no authentication — database was fully open
- Fixed: Created MongoDB admin user, enabled `authorization: enabled` in `/etc/mongod.conf`, updated app connection string to use credentials

**npm audit**
- Initial: 29 vulnerabilities (3 critical, 14 high, 5 moderate, 7 low)
- After `npm audit fix` + package upgrades: 7 remaining — all accepted/documented risks in `jade` (requires full migration to `pug`) and `csurf` (deprecated, used per task requirements)

**Final Penetration Test (Metasploit + curl)**
- Port scan: only expected ports open (3000, 27017, 22)
- Directory enumeration: `/admin` and `/users/` returned 200 — investigated and fixed
- HTTP header scan: 13 security headers confirmed present
- CSRF test: all 20 requests without token returned 403 Forbidden — protection confirmed working
- Brute force/rate limiter test: 429 Too Many Requests triggered from request 5 onwards — confirmed working

**Pentest Fixes Applied**
- `/admin` route now requires authentication — unauthenticated requests redirect to home page
- `card` field excluded from `/users/userlist` MongoDB projection — credit card data no longer exposed via API
- Removed `ajax.googleapis.com` from CSP `scriptSrc` whitelist — jQuery is served locally, whitelist entry was unnecessary attack surface

---

## Running the Application

### Prerequisites — MongoDB Setup

This application requires MongoDB with authentication enabled. Complete this setup once before running the app.

**1. Install MongoDB** (if not already installed):
```bash
sudo apt install mongodb -y   # Debian/Ubuntu/Kali
```

**2. Start MongoDB without auth and create the admin user:**
```bash
sudo mongod --dbpath /var/lib/mongodb --logpath /var/log/mongodb/mongod.log --fork
mongo --eval "
  use admin;
  db.createUser({
    user: 'admin',
    pwd: 'admin123',
    roles: [{ role: 'root', db: 'admin' }]
  });
"
sudo pkill mongod
```

**3. Create the MongoDB config file with authentication enabled:**
```bash
sudo bash -c 'cat > /etc/mongod.conf << EOF
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  path: /var/log/mongodb/mongod.log
  logAppend: true
net:
  port: 27017
  bindIp: 127.0.0.1
security:
  authorization: enabled
EOF'
```

**4. Enable MongoDB to start automatically on boot:**
```bash
sudo bash -c 'cat > /etc/systemd/system/mongod.service << EOF
[Unit]
Description=MongoDB Database Server
After=network.target

[Service]
User=root
ExecStart=/usr/bin/mongod --config /etc/mongod.conf
Restart=always

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable mongod
systemctl start mongod'
```

After this, MongoDB starts automatically on every boot — no manual steps needed.

---

### Running the App

```bash
# Clone the repository
git clone https://github.com/SawaizRamzan/vulnerable-nodejs.git
cd vulnerable-nodejs

# Switch to secured branch
git checkout internship

# Install dependencies
npm install

# Seed the database (creates default admin user)
npm run seed

# Start the application
npm start
```

App runs at `http://localhost:3000`

**Default credentials:**
- Username: `admin`
- Password: `admin123`

> The seed script hashes the password with bcrypt before storing it. Run `npm run seed` only once — it skips if the admin user already exists.

> **Note:** If you see `MongoError: Command find requires authentication`, MongoDB is not running. Start it with `sudo systemctl start mongod` (if you completed the setup above) or `sudo mongod --config /etc/mongod.conf --fork`.

---

## Tools Used

| Tool | Purpose |
|------|---------|
| OWASP ZAP | Automated vulnerability scanning |
| Nikto | Web server configuration scanning |
| Lynis | OS-level security auditing |
| Trivy | Dependency & container vulnerability scanning |
| Burp Suite | Manual penetration testing |
| SQLMap | SQL injection testing |
| Metasploit | Penetration testing — port scan, directory enumeration, header analysis |
| Nmap | Network reconnaissance |
| Fail2Ban | Intrusion detection & IP banning |
| Kali Linux | Penetration testing environment |
| Helmet.js | Security headers |
| bcrypt | Password hashing |
| jsonwebtoken | JWT authentication |
| express-rate-limit | Rate limiting |
| validator | Input validation |
| winston | Security logging |
| cors | CORS policy enforcement |
| csurf | CSRF protection |

---

## GitHub Repository

- **Repo:** https://github.com/SawaizRamzan/vulnerable-nodejs
- **Secured branch:** https://github.com/SawaizRamzan/vulnerable-nodejs/tree/internship
- **Phase 1 tag:** https://github.com/SawaizRamzan/vulnerable-nodejs/releases/tag/phase-1-complete
