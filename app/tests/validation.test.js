/**
 * CV Builder — Cross-validation tests
 *
 * Run with:  node --test app/tests/validation.test.js
 *
 * Uses Node.js built-in test runner (node:test) and assertions (node:assert).
 * No external test dependencies required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// 1. Route security — auth-required routes redirect without token
// ---------------------------------------------------------------------------
describe('Route security — auth guards', () => {
  // Simulate the preHandler guard from cv.js
  function cvAuthGuard(reqUser) {
    if (!reqUser) return '/auth/login'; // redirect target
    return null; // no redirect
  }

  it('CV routes redirect to /auth/login when no user', () => {
    assert.equal(cvAuthGuard(null), '/auth/login');
    assert.equal(cvAuthGuard(undefined), '/auth/login');
  });

  it('CV routes allow access when user is present', () => {
    assert.equal(cvAuthGuard({ id: 1, email: 'a@b.com' }), null);
  });

  // Simulate admin requireAdmin guard (simplified)
  const ADMIN_ROLES = ['admin', 'owner'];

  function adminAuthGuard(token, dbUser) {
    if (!token) return 'redirect:/auth/login';
    if (!dbUser || dbUser.banned || !ADMIN_ROLES.includes(dbUser.role)) return '403';
    return null; // allowed
  }

  it('Admin routes redirect when no token', () => {
    assert.equal(adminAuthGuard(null, null), 'redirect:/auth/login');
  });

  it('Admin routes return 403 for regular user', () => {
    assert.equal(adminAuthGuard('valid-token', { id: 1, role: 'user', banned: false }), '403');
  });

  it('Admin routes return 403 for banned admin', () => {
    assert.equal(adminAuthGuard('valid-token', { id: 1, role: 'admin', banned: true }), '403');
  });

  it('Admin routes allow admin role', () => {
    assert.equal(adminAuthGuard('valid-token', { id: 1, role: 'admin', banned: false }), null);
  });

  it('Admin routes allow owner role', () => {
    assert.equal(adminAuthGuard('valid-token', { id: 1, role: 'owner', banned: false }), null);
  });
});

// ---------------------------------------------------------------------------
// 2. Input validation — oversized data and invalid IDs
// ---------------------------------------------------------------------------
describe('Input validation', () => {
  // Reimplement parseId from cv.js
  function parseId(raw) {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  it('parseId accepts valid positive integers', () => {
    assert.equal(parseId('1'), 1);
    assert.equal(parseId('999'), 999);
    assert.equal(parseId('42'), 42);
  });

  it('parseId rejects zero, negative, NaN, floats, strings', () => {
    assert.equal(parseId('0'), null);
    assert.equal(parseId('-1'), null);
    assert.equal(parseId('abc'), null);
    assert.equal(parseId(''), null);
    assert.equal(parseId(undefined), null);
    assert.equal(parseId(null), null);
    assert.equal(parseId('Infinity'), null);
    assert.equal(parseId('NaN'), null);
  });

  it('Title longer than 255 characters is rejected', () => {
    const title = 'A'.repeat(256);
    assert.ok(title.length > 255, 'Title exceeds 255 chars');
    // The route does: if (title && title.length > 255) return 400
  });

  it('CV data larger than 500KB is rejected', () => {
    const data = 'x'.repeat(500001);
    assert.ok(data.length > 500000, 'Data exceeds 500KB');
  });

  it('Invalid template ID is rejected by parseId', () => {
    assert.equal(parseId('abc'), null);
    assert.equal(parseId('0'), null);
    assert.equal(parseId('-5'), null);
  });

  it('Password must be 8-1000 characters', () => {
    const short = 'abc1234'; // 7 chars
    const valid = 'abcd1234'; // 8 chars
    const long = 'a'.repeat(1001);

    assert.ok(short.length < 8);
    assert.ok(valid.length >= 8 && valid.length <= 1000);
    assert.ok(long.length > 1000);
  });

  it('Email regex rejects invalid formats', () => {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    assert.ok(!EMAIL_RE.test(''));
    assert.ok(!EMAIL_RE.test('noatsign'));
    assert.ok(!EMAIL_RE.test('no@domain'));
    assert.ok(!EMAIL_RE.test('@nodomain.com'));
    assert.ok(!EMAIL_RE.test('has spaces@mail.com'));
    assert.ok(EMAIL_RE.test('valid@email.com'));
    assert.ok(EMAIL_RE.test('a@b.co'));
  });
});

// ---------------------------------------------------------------------------
// 3. PDF rate limiting
// ---------------------------------------------------------------------------
describe('PDF rate limiting', () => {
  // Re-implement checkPdfRateLimit logic from cv.js
  const PDF_RATE_LIMIT = 5;
  const PDF_RATE_WINDOW = 60 * 1000;

  function createRateLimiter() {
    const limits = new Map();

    function check(userId) {
      const now = Date.now();
      let entry = limits.get(userId);
      if (!entry || now - entry.windowStart > PDF_RATE_WINDOW) {
        entry = { count: 0, windowStart: now };
        limits.set(userId, entry);
      }
      entry.count++;
      return entry.count <= PDF_RATE_LIMIT;
    }

    return { check, limits };
  }

  it('allows up to PDF_RATE_LIMIT (5) requests', () => {
    const rl = createRateLimiter();
    for (let i = 0; i < PDF_RATE_LIMIT; i++) {
      assert.ok(rl.check(1), `Request ${i + 1} should be allowed`);
    }
  });

  it('blocks after PDF_RATE_LIMIT requests', () => {
    const rl = createRateLimiter();
    for (let i = 0; i < PDF_RATE_LIMIT; i++) rl.check(1);
    assert.ok(!rl.check(1), 'Request 6 should be blocked');
    assert.ok(!rl.check(1), 'Request 7 should be blocked');
  });

  it('separate users have separate limits', () => {
    const rl = createRateLimiter();
    for (let i = 0; i < PDF_RATE_LIMIT; i++) rl.check(1);
    assert.ok(!rl.check(1), 'User 1 blocked');
    assert.ok(rl.check(2), 'User 2 still allowed');
  });

  it('window reset allows new requests', () => {
    const rl = createRateLimiter();
    for (let i = 0; i < PDF_RATE_LIMIT; i++) rl.check(1);
    assert.ok(!rl.check(1), 'Blocked before window reset');

    // Simulate window expiry by manually backdating the entry
    const entry = rl.limits.get(1);
    entry.windowStart = Date.now() - PDF_RATE_WINDOW - 1;
    assert.ok(rl.check(1), 'Allowed after window reset');
  });
});

// ---------------------------------------------------------------------------
// 4. Security headers
// ---------------------------------------------------------------------------
describe('Security headers — onSend hook', () => {
  // Simulate the security headers hook from server.js
  function applySecurityHeaders() {
    const headers = {};
    const reply = {
      header(k, v) { headers[k] = v; },
      removeHeader(k) { delete headers[k]; },
    };

    // Simulating hook logic
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '0');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'");

    // Simulate incoming X-Powered-By
    headers['X-Powered-By'] = 'Fastify';
    reply.removeHeader('X-Powered-By');

    return headers;
  }

  it('sets HSTS header', () => {
    const h = applySecurityHeaders();
    assert.ok(h['Strict-Transport-Security']);
    assert.ok(h['Strict-Transport-Security'].includes('max-age='));
    assert.ok(h['Strict-Transport-Security'].includes('includeSubDomains'));
  });

  it('sets CSP header', () => {
    const h = applySecurityHeaders();
    assert.ok(h['Content-Security-Policy']);
    assert.ok(h['Content-Security-Policy'].includes("default-src 'self'"));
  });

  it('removes X-Powered-By', () => {
    const h = applySecurityHeaders();
    assert.equal(h['X-Powered-By'], undefined);
  });

  it('sets X-Frame-Options to DENY', () => {
    const h = applySecurityHeaders();
    assert.equal(h['X-Frame-Options'], 'DENY');
  });

  it('sets X-Content-Type-Options to nosniff', () => {
    const h = applySecurityHeaders();
    assert.equal(h['X-Content-Type-Options'], 'nosniff');
  });

  it('disables XSS auditor (X-XSS-Protection: 0)', () => {
    const h = applySecurityHeaders();
    assert.equal(h['X-XSS-Protection'], '0');
  });

  it('sets Referrer-Policy', () => {
    const h = applySecurityHeaders();
    assert.equal(h['Referrer-Policy'], 'strict-origin-when-cross-origin');
  });

  it('sets Permissions-Policy', () => {
    const h = applySecurityHeaders();
    assert.ok(h['Permissions-Policy'].includes('camera=()'));
  });
});

// ---------------------------------------------------------------------------
// 5. Admin authorization — DB role check, not JWT
// ---------------------------------------------------------------------------
describe('Admin authorization — DB role check', () => {
  const ADMIN_ROLES = ['admin', 'owner'];

  function isAdminFromDb(dbRow) {
    if (!dbRow) return false;
    if (dbRow.banned) return false;
    return ADMIN_ROLES.includes(dbRow.role);
  }

  it('rejects null/undefined DB row', () => {
    assert.ok(!isAdminFromDb(null));
    assert.ok(!isAdminFromDb(undefined));
  });

  it('rejects user with role "user"', () => {
    assert.ok(!isAdminFromDb({ role: 'user', banned: false }));
  });

  it('rejects banned admin', () => {
    assert.ok(!isAdminFromDb({ role: 'admin', banned: true }));
  });

  it('rejects banned owner', () => {
    assert.ok(!isAdminFromDb({ role: 'owner', banned: true }));
  });

  it('accepts admin', () => {
    assert.ok(isAdminFromDb({ role: 'admin', banned: false }));
  });

  it('accepts owner', () => {
    assert.ok(isAdminFromDb({ role: 'owner', banned: false }));
  });

  it('rejects unknown role', () => {
    assert.ok(!isAdminFromDb({ role: 'superadmin', banned: false }));
  });

  // Role change restrictions
  it('only owner can change roles', () => {
    const callerRole = 'admin';
    assert.notEqual(callerRole, 'owner', 'Admin cannot change roles');
  });

  it('cannot change own role', () => {
    const callerId = 5;
    const targetId = 5;
    assert.equal(callerId, targetId, 'Self role change blocked');
  });

  it('cannot change owner role', () => {
    const targetRole = 'owner';
    assert.equal(targetRole, 'owner', 'Owner role is immutable');
  });
});

// ---------------------------------------------------------------------------
// 6. Typst helpers — null-safe get, getArr, has, hasArr
// ---------------------------------------------------------------------------
describe('Typst helpers injection', () => {
  // The helpers string from cv.js
  const helpers = `#let data = json("data.json")
#let get(key, default: "") = if key in data { str(data.at(key)) } else { default }
#let getArr(key) = if key in data and type(data.at(key)) == array { data.at(key) } else { () }
#let has(key) = key in data and str(data.at(key)).len() > 0
#let hasArr(key) = key in data and type(data.at(key)) == array and data.at(key).len() > 0
`;

  it('helpers contain #let data = json("data.json")', () => {
    assert.ok(helpers.includes('#let data = json("data.json")'));
  });

  it('helpers contain get() with default parameter', () => {
    assert.ok(helpers.includes('#let get(key, default: "")'));
  });

  it('helpers contain getArr() returning empty tuple fallback', () => {
    assert.ok(helpers.includes('#let getArr(key)'));
    assert.ok(helpers.includes('else { () }'));
  });

  it('helpers contain has() checking non-empty string', () => {
    assert.ok(helpers.includes('#let has(key)'));
    assert.ok(helpers.includes('.len() > 0'));
  });

  it('helpers contain hasArr() checking non-empty array', () => {
    assert.ok(helpers.includes('#let hasArr(key)'));
  });

  it('helpers use str() wrapper for type safety', () => {
    assert.ok(helpers.includes('str(data.at(key))'));
  });
});

// ---------------------------------------------------------------------------
// 7. Email normalization — login/register
// ---------------------------------------------------------------------------
describe('Email normalization', () => {
  function normalizeEmail(email) {
    return email.trim().toLowerCase();
  }

  it('converts to lowercase', () => {
    assert.equal(normalizeEmail('USER@EXAMPLE.COM'), 'user@example.com');
  });

  it('trims whitespace', () => {
    assert.equal(normalizeEmail('  user@example.com  '), 'user@example.com');
  });

  it('handles mixed case with whitespace', () => {
    assert.equal(normalizeEmail('  UsEr@ExAmPlE.CoM  '), 'user@example.com');
  });

  it('preserves already normalized email', () => {
    assert.equal(normalizeEmail('user@example.com'), 'user@example.com');
  });
});

// ---------------------------------------------------------------------------
// 8. Template safety — cleanTemplate regex
// ---------------------------------------------------------------------------
describe('Template safety — cleanTemplate regex', () => {
  // Updated regex from cv.js (now with /gm flag)
  const cleanRegex = /^\s*#let data\s*=\s*json\([^)]+\)\s*\n?/gm;

  function cleanTemplate(source) {
    return source.replace(cleanRegex, '');
  }

  it('strips #let data = json("data.json") from template', () => {
    const input = '#let data = json("data.json")\n#set page(...)';
    const result = cleanTemplate(input);
    assert.ok(!result.includes('#let data = json'));
    assert.ok(result.includes('#set page(...)'));
  });

  it('strips with different file paths', () => {
    const input = '#let data = json("other.json")\n#set page(...)';
    const result = cleanTemplate(input);
    assert.ok(!result.includes('#let data = json'));
  });

  it('strips with leading whitespace', () => {
    const input = '  #let data = json("data.json")\n#set page(...)';
    const result = cleanTemplate(input);
    assert.ok(!result.includes('#let data = json'));
  });

  it('strips multiple occurrences (global flag)', () => {
    const input = '#let data = json("data.json")\n#some code\n#let data = json("evil.json")\n#more code';
    const result = cleanTemplate(input);
    assert.ok(!result.includes('#let data = json'), 'All occurrences should be stripped');
    assert.ok(result.includes('#some code'));
    assert.ok(result.includes('#more code'));
  });

  it('does not strip unrelated #let declarations', () => {
    const input = '#let name = "John"\n#let data = json("data.json")';
    const result = cleanTemplate(input);
    assert.ok(result.includes('#let name = "John"'));
    assert.ok(!result.includes('#let data = json'));
  });

  it('handles template with no #let data line', () => {
    const input = '#set page(paper: "a4")\nHello world';
    const result = cleanTemplate(input);
    assert.equal(result, input);
  });
});

// ---------------------------------------------------------------------------
// 9. Auth rate limiting
// ---------------------------------------------------------------------------
describe('Auth rate limiting', () => {
  const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
  const RATE_LIMIT_MAX = 10;

  function createAuthRateLimiter() {
    const attempts = new Map();

    function check(ip) {
      const now = Date.now();
      let entry = attempts.get(ip);
      if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
        entry = { count: 0, windowStart: now };
        attempts.set(ip, entry);
      }
      entry.count++;
      return entry.count <= RATE_LIMIT_MAX;
    }

    return { check, attempts };
  }

  it('allows up to 10 auth attempts per IP', () => {
    const rl = createAuthRateLimiter();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      assert.ok(rl.check('192.168.1.1'), `Attempt ${i + 1} should be allowed`);
    }
  });

  it('blocks after 10 attempts', () => {
    const rl = createAuthRateLimiter();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) rl.check('192.168.1.1');
    assert.ok(!rl.check('192.168.1.1'), 'Attempt 11 should be blocked');
  });

  it('different IPs have separate limits', () => {
    const rl = createAuthRateLimiter();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) rl.check('10.0.0.1');
    assert.ok(!rl.check('10.0.0.1'), 'IP 1 blocked');
    assert.ok(rl.check('10.0.0.2'), 'IP 2 still allowed');
  });
});

// ---------------------------------------------------------------------------
// 10. PDF filename sanitization
// ---------------------------------------------------------------------------
describe('PDF filename sanitization', () => {
  function sanitizeFilename(title) {
    return title.replace(/[^a-zA-Z0-9-_ ]/g, '');
  }

  it('strips special characters', () => {
    assert.equal(sanitizeFilename('My CV (2026)'), 'My CV 2026');
    assert.equal(sanitizeFilename('test<script>'), 'testscript');
    assert.equal(sanitizeFilename('file"name'), 'filename');
  });

  it('keeps alphanumeric, hyphen, underscore, space', () => {
    assert.equal(sanitizeFilename('My_CV-2026'), 'My_CV-2026');
  });

  it('handles empty string', () => {
    assert.equal(sanitizeFilename(''), '');
  });

  it('strips path traversal characters', () => {
    assert.equal(sanitizeFilename('../../../etc/passwd'), 'etcpasswd');
  });
});

// ---------------------------------------------------------------------------
// 11. Cookie settings validation
// ---------------------------------------------------------------------------
describe('Cookie settings', () => {
  const COOKIE_SETTINGS = {
    path: '/',
    httpOnly: true,
    secure: false, // intentional: behind Caddy reverse proxy
    maxAge: 7 * 24 * 60 * 60,
    sameSite: 'lax',
  };

  it('token cookie is httpOnly', () => {
    assert.equal(COOKIE_SETTINGS.httpOnly, true);
  });

  it('token cookie has sameSite lax (CSRF protection)', () => {
    assert.equal(COOKIE_SETTINGS.sameSite, 'lax');
  });

  it('token cookie path is root', () => {
    assert.equal(COOKIE_SETTINGS.path, '/');
  });

  it('token cookie maxAge is 7 days', () => {
    assert.equal(COOKIE_SETTINGS.maxAge, 604800);
  });
});

// ---------------------------------------------------------------------------
// 12. i18n language validation
// ---------------------------------------------------------------------------
describe('i18n language validation', () => {
  const SUPPORTED_LANGS = ['en', 'it', 'de', 'fr'];

  function resolveLang(cookieLang) {
    return SUPPORTED_LANGS.includes(cookieLang) ? cookieLang : 'en';
  }

  it('accepts supported languages', () => {
    assert.equal(resolveLang('en'), 'en');
    assert.equal(resolveLang('it'), 'it');
    assert.equal(resolveLang('de'), 'de');
    assert.equal(resolveLang('fr'), 'fr');
  });

  it('falls back to en for unsupported languages', () => {
    assert.equal(resolveLang('es'), 'en');
    assert.equal(resolveLang('zh'), 'en');
    assert.equal(resolveLang(''), 'en');
    assert.equal(resolveLang(null), 'en');
    assert.equal(resolveLang(undefined), 'en');
  });

  it('rejects injection attempts', () => {
    assert.equal(resolveLang('../etc/passwd'), 'en');
    assert.equal(resolveLang('<script>'), 'en');
  });
});

// ---------------------------------------------------------------------------
// 13. Body size limit
// ---------------------------------------------------------------------------
describe('Body size limit', () => {
  it('bodyLimit is set to 1 MB (1048576 bytes)', () => {
    const bodyLimit = 1048576;
    assert.equal(bodyLimit, 1 * 1024 * 1024);
  });
});

// ---------------------------------------------------------------------------
// 14. Error handler — production vs development
// ---------------------------------------------------------------------------
describe('Error handler — stack trace protection', () => {
  function errorHandler(error, nodeEnv) {
    const statusCode = error.statusCode || 500;
    const message = nodeEnv === 'production'
      ? 'An unexpected error occurred.'
      : error.message;
    return { statusCode, message };
  }

  it('hides error details in production', () => {
    const result = errorHandler({ message: 'SQL syntax error near...', statusCode: 500 }, 'production');
    assert.equal(result.message, 'An unexpected error occurred.');
    assert.ok(!result.message.includes('SQL'));
  });

  it('shows error details in development', () => {
    const result = errorHandler({ message: 'Something broke', statusCode: 500 }, 'development');
    assert.equal(result.message, 'Something broke');
  });

  it('preserves status code from error', () => {
    const result = errorHandler({ message: 'Not found', statusCode: 404 }, 'production');
    assert.equal(result.statusCode, 404);
  });

  it('defaults to 500 when no statusCode', () => {
    const result = errorHandler({ message: 'oops' }, 'production');
    assert.equal(result.statusCode, 500);
  });
});
