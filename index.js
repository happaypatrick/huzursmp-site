// HuzurSmp secure auth Worker.
// Deploy: wrangler deploy
// Secrets: wrangler secret put MAIL_API_KEY / CODE_SECRET / SESSION_SECRET

const DEFAULT_ORIGIN = 'https://happaypatrick.github.io';
const SESSION_TTL = 30 * 24 * 60 * 60;
const CHALLENGE_TTL = 10 * 60;
const MAX_CODE_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS = 10;
const MAX_CHALLENGES_PER_NICK = 5;
const WINDOW_15_MIN = 15 * 60;

export default {
  async fetch(request, env) {
    const corsHeaders = buildCors(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/api/register' && request.method === 'POST') {
        return await register(request, env, corsHeaders);
      }
      if (path === '/api/verify-email' && request.method === 'POST') {
        return await verifyEmail(request, env, corsHeaders);
      }
      if (path === '/api/login' && request.method === 'POST') {
        return await login(request, env, corsHeaders);
      }
      if (path === '/api/verify' && request.method === 'POST') {
        return await verifyChallenge(request, env, corsHeaders);
      }
      if (path === '/api/logout' && request.method === 'POST') {
        return await logout(request, env, corsHeaders);
      }
      if (path === '/api/me' && request.method === 'GET') {
        return await me(request, env, corsHeaders);
      }
      if (path === '/api/health' && request.method === 'GET') {
        return json({ ok: true, service: 'huzursmp-auth' }, 200, corsHeaders);
      }

      return json({ error: 'Bulunamadi.' }, 404, corsHeaders);
    } catch (error) {
      return json({ error: error && error.message ? error.message : 'Sunucu hatasi.' }, 500, corsHeaders);
    }
  }
};

function buildCors(request, env) {
  const allowed = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
  const origin = request.headers.get('Origin') || allowed;

  return {
    'Access-Control-Allow-Origin': origin === allowed ? origin : allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
    'Cache-Control': 'no-store'
  };
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    throw new Error('Gecersiz istek.');
  }
}

function cleanNick(value) {
  return String(value || '').trim().toLowerCase();
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validNick(nick) {
  return /^[a-z0-9_]{3,16}$/.test(nick);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function maskEmail(email) {
  const [name, domain] = String(email).split('@');
  if (!domain) return 'e-posta';
  return `${name.slice(0, 2)}***@${domain}`;
}

function clientIp(request) {
  return String(
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    'unknown'
  ).trim();
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function randomHex(length = 32) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(length)));
}

function textEncoder() {
  return new TextEncoder();
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder().encode(text));
  return bytesToHex(digest);
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', textEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    key,
    256
  );
  return { salt: bytesToHex(salt), hash: bytesToHex(bits) };
}

async function verifyPassword(password, user) {
  const attempt = await hashPassword(password, user.salt);
  return constantTimeEqual(attempt.hash, user.hash);
}

async function codeHash(code, challengeId, env) {
  return sha256Hex(`${code}:${challengeId}:${env.CODE_SECRET || ''}`);
}

function makeCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(value).padStart(6, '0');
}

async function hitRateLimit(env, key, limit, windowSec) {
  const now = Date.now();
  const raw = await env.AUTH_KV.get(key, 'json');
  const state = raw && raw.exp > now ? raw : { count: 0, exp: now + windowSec * 1000 };
  state.count += 1;

  await env.AUTH_KV.put(key, JSON.stringify(state), {
    expirationTtl: Math.max(60, Math.ceil((state.exp - now) / 1000))
  });

  return state.count <= limit;
}

function getCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [key, value] = part.trim().split('=');
    if (key === name) return value;
  }
  return null;
}

function sessionCookie(token, maxAge) {
  return `huzursmp_session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAge}`;
}

function clearCookieHeaders() {
  return { 'Set-Cookie': 'huzursmp_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0' };
}

async function issueSession(env, nickLower, deviceId, ip, headers) {
  const token = randomHex(32);
  const session = {
    nick: nickLower,
    deviceId,
    ip,
    createdAt: Date.now(),
    exp: Date.now() + SESSION_TTL * 1000
  };

  await env.AUTH_KV.put(`session:${token}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });

  return {
    ...headers,
    'Set-Cookie': sessionCookie(token, SESSION_TTL)
  };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendMail(env, to, subject, text) {
  const provider = String(env.MAIL_PROVIDER || 'resend').toLowerCase();
  const html = `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;

  if (provider === 'brevo') {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.MAIL_API_KEY || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'HuzurSmp', email: env.MAIL_FROM?.match(/<([^>]+)>/)?.[1] || env.MAIL_FROM },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text
      })
    });

    if (!response.ok) {
      throw new Error(`E-posta gonderilemedi (Brevo ${response.status}).`);
    }
    return;
  }

  if (provider === 'emailjs') {
    throw new Error('EmailJS bu Worker icin desteklenmiyor. Resend veya Brevo kullan.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.MAIL_API_KEY || ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text, html })
  });

  if (!response.ok) {
    throw new Error(`E-posta gonderilemedi (Resend ${response.status}).`);
  }
}

async function register(request, env, cors) {
  const body = await readJson(request);
  const nick = cleanNick(body.nick);
  const email = cleanEmail(body.email);
  const password = String(body.password || '');

  if (!validNick(nick)) throw new Error('Oyuncu adı 3-16 karakter, sadece harf/rakam/_ olabilir.');
  if (!validEmail(email)) throw new Error('Gecerli bir e-posta adresi gir.');
  if (password.length < 8) throw new Error('Şifre en az 8 karakter olmali.');

  if (!(await hitRateLimit(env, `rl:register:${clientIp(request)}`, 5, WINDOW_15_MIN))) {
    throw new Error('Cok fazla kayit denemesi. Biraz bekle.');
  }

  const existingNick = await env.AUTH_KV.get(`user:${nick}`);
  const existingEmail = await env.AUTH_KV.get(`email:${email}`);
  if (existingNick || existingEmail) throw new Error('Bu oyuncu adi veya e-posta zaten kayitli.');

  const { salt, hash } = await hashPassword(password);
  const user = {
    nick: body.nick.toString().trim(),
    nickLower: nick,
    email,
    salt,
    hash,
    verified: false,
    createdAt: Date.now(),
    failedLogins: 0,
    lockedUntil: 0
  };

  const code = makeCode();
  const challengeId = `email:${nick}`;

  await env.AUTH_KV.put(`user:${nick}`, JSON.stringify(user));
  await env.AUTH_KV.put(`email:${email}`, nick);
  await env.AUTH_KV.put(challengeId, JSON.stringify({
    codeHash: await codeHash(code, challengeId, env),
    exp: Date.now() + CHALLENGE_TTL * 1000,
    attempts: 0
  }), { expirationTtl: CHALLENGE_TTL });

  await sendMail(
    env,
    email,
    'HuzurSmp e-posta dogrulama',
    `Merhaba ${user.nick},\n\nHuzurSmp hesabini dogrulamak icin kodu gir: ${code}\n\nBu kod 10 dakika gecerli.\n\nSen yapmadiysan bu e-postayi yok say.`
  );

  return json({ ok: true, needsEmailCode: true, nick: user.nick, emailHint: maskEmail(email) }, 200, cors);
}

async function verifyEmail(request, env, cors) {
  const body = await readJson(request);
  const nick = cleanNick(body.nick);
  const code = String(body.code || '').trim();
  const challengeId = `email:${nick}`;

  const challenge = await env.AUTH_KV.get(challengeId, 'json');
  if (!challenge || challenge.exp < Date.now()) throw new Error('Kod suresi doldu. Tekrar kayit ol.');
  if (challenge.attempts >= MAX_CODE_ATTEMPTS) throw new Error('Cok fazla yanlis kod. Tekrar kayit ol.');

  if (!constantTimeEqual(await codeHash(code, challengeId, env), challenge.codeHash)) {
    challenge.attempts += 1;
    await env.AUTH_KV.put(challengeId, JSON.stringify(challenge), { expirationTtl: CHALLENGE_TTL });
    throw new Error('Kod yanlis.');
  }

  const user = await env.AUTH_KV.get(`user:${nick}`, 'json');
  if (!user) throw new Error('Kullanici bulunamadi.');

  user.verified = true;
  await env.AUTH_KV.put(`user:${nick}`, JSON.stringify(user));
  await env.AUTH_KV.delete(challengeId);

  return json({ ok: true, verified: true }, 200, cors);
}

async function login(request, env, cors) {
  const body = await readJson(request);
  const nick = cleanNick(body.nick);
  const password = String(body.password || '');
  const deviceId = String(body.deviceId || '').slice(0, 64);
  const ip = clientIp(request);

  if (!nick || !password || !deviceId) throw new Error('Eksik giris bilgisi.');

  if (!(await hitRateLimit(env, `rl:login:${ip}`, MAX_LOGIN_ATTEMPTS, WINDOW_15_MIN))) {
    throw new Error('Cok fazla giris denemesi. Biraz bekle.');
  }

  const user = await env.AUTH_KV.get(`user:${nick}`, 'json');
  if (!user || !user.verified || user.lockedUntil > Date.now()) {
    throw new Error('Oyuncu adi veya sifre yanlis.');
  }

  if (!(await verifyPassword(password, user))) {
    user.failedLogins = (user.failedLogins || 0) + 1;
    if (user.failedLogins >= 5) {
      user.failedLogins = 0;
      user.lockedUntil = Date.now() + 15 * 60 * 1000;
    }
    await env.AUTH_KV.put(`user:${nick}`, JSON.stringify(user));
    throw new Error('Oyuncu adi veya sifre yanlis.');
  }

  user.failedLogins = 0;
  user.lockedUntil = 0;
  await env.AUTH_KV.put(`user:${nick}`, JSON.stringify(user));

  const devices = await env.AUTH_KV.get(`devices:${nick}`, 'json') || {};
  const known = devices[deviceId];
  if (known && known.trusted === true && known.ip === ip) {
    const headers = await issueSession(env, nick, deviceId, ip, {});
    return json({ ok: true, nick: user.nick }, 200, { ...cors, ...headers });
  }

  if (!(await hitRateLimit(env, `rl:challenge:${nick}`, MAX_CHALLENGES_PER_NICK, WINDOW_15_MIN))) {
    throw new Error('Cok fazla dogrulama kodu istendi. Biraz bekle.');
  }

  const code = makeCode();
  const challengeId = randomHex(16);

  await env.AUTH_KV.put(`challenge:${challengeId}`, JSON.stringify({
    nick,
    nickDisplay: user.nick,
    codeHash: await codeHash(code, challengeId, env),
    deviceId,
    ip,
    exp: Date.now() + CHALLENGE_TTL * 1000,
    attempts: 0
  }), { expirationTtl: CHALLENGE_TTL });

  await sendMail(
    env,
    user.email,
    'HuzurSmp yeni cihaz girisi',
    `Merhaba ${user.nick},\n\nHesabina yeni bir cihazdan veya farkli bir IP'den giris denendi. Kodu girerek devam et: ${code}\n\nBu kod 10 dakika gecerli.\n\nSen degilsen sifreni degistir.`
  );

  return json({
    ok: true,
    needsCode: true,
    challenge: challengeId,
    nick: user.nick,
    emailHint: maskEmail(user.email),
    reason: known ? 'IP degisti' : 'yeni cihaz'
  }, 200, cors);
}

async function verifyChallenge(request, env, cors) {
  const body = await readJson(request);
  const challengeId = String(body.challenge || '').slice(0, 64);
  const code = String(body.code || '').trim();
  const deviceId = String(body.deviceId || '').slice(0, 64);
  const ip = clientIp(request);

  if (!challengeId || !code || !deviceId) throw new Error('Eksik dogrulama bilgisi.');

  const key = `challenge:${challengeId}`;
  const challenge = await env.AUTH_KV.get(key, 'json');
  if (!challenge || challenge.exp < Date.now()) throw new Error('Kod suresi doldu. Tekrar giris yap.');
  if (challenge.deviceId !== deviceId) throw new Error('Bu kod baska bir cihaz icin.');
  if (challenge.attempts >= MAX_CODE_ATTEMPTS) {
    await env.AUTH_KV.delete(key);
    throw new Error('Cok fazla yanlis kod. Tekrar giris yap.');
  }

  if (!constantTimeEqual(await codeHash(code, challengeId, env), challenge.codeHash)) {
    challenge.attempts += 1;
    await env.AUTH_KV.put(key, JSON.stringify(challenge), { expirationTtl: CHALLENGE_TTL });
    throw new Error('Kod yanlis.');
  }

  const devices = await env.AUTH_KV.get(`devices:${challenge.nick}`, 'json') || {};
  devices[deviceId] = { trusted: true, ip, lastSeen: Date.now() };
  await env.AUTH_KV.put(`devices:${challenge.nick}`, JSON.stringify(devices));
  await env.AUTH_KV.delete(key);

  const headers = await issueSession(env, challenge.nick, deviceId, ip, {});
  return json({ ok: true, nick: challenge.nickDisplay || challenge.nick }, 200, { ...cors, ...headers });
}

async function logout(request, env, cors) {
  const token = getCookie(request, 'huzursmp_session');
  if (token) await env.AUTH_KV.delete(`session:${token}`);
  return json({ ok: true }, 200, { ...cors, ...clearCookieHeaders() });
}

async function me(request, env, cors) {
  const token = getCookie(request, 'huzursmp_session');
  if (!token) return json({ nick: null }, 200, cors);

  const session = await env.AUTH_KV.get(`session:${token}`, 'json');
  if (!session || session.exp < Date.now()) {
    return json({ nick: null }, 200, { ...cors, ...clearCookieHeaders() });
  }

  const user = await env.AUTH_KV.get(`user:${session.nick}`, 'json');
  return json({ nick: user ? user.nick : null }, 200, cors);
}
