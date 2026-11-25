const SERVER_IP = 'fried-latch.tun.ply.gg';
const STATUS_API = `https://api.mcsrvstat.us/3/${SERVER_IP}`;
const STATUS_REFRESH_MS = 60000;
const STATUS_CACHE_KEY = 'huzursmp_status_cache';
const STATUS_FAILS_KEY = 'huzursmp_status_fails';
const STATUS_CACHE_MS = 5 * 60 * 1000;
const THEME_KEY = 'huzursmp_theme';

const AUTH_USERS_KEY = 'huzursmp_site_users';
const AUTH_SESSION_KEY = 'huzursmp_site_session';
const PROFILE_KEY = 'huzursmp_site_profiles';
const RESERVED_NICKS = ['happaypatrickd', 'happaypatrick', 'mavzerina'];
const AUTH_LOCK_KEY = 'huzursmp_auth_lock';
const AUTH_MAX_FAILS = 5;
const AUTH_LOCK_MS = 30000;

// Worker yayına alındığında buraya Worker adresini yaz.
// Boş kalırsa eski yerel giriş modu çalışmaya devam eder.
const AUTH_API_BASE = '';
const AUTH_SECURE_MODE = AUTH_API_BASE.length > 0;
const AUTH_DEVICE_KEY = 'huzursmp_device_id';

// Kurucu otomatik girisi: tek kullanimlik gizli link ile bu tarayicida kalici acilir.
const OWNER_NICK = 'happaypatrickD';
const OWNER_AUTO_KEY = 'huzursmp_owner_auto';
const OWNER_TOKEN_HASH = 'd4b25803a0ac2afe5bdd7c814ce787f1d605def69a6b3a3f3555208a08a4150d';

const STAFF_ROLES = ['Kurucu', 'Admin', 'Mod', 'Rehber'];
const STAFF_ROLE_LABELS = {
    Kurucu: 'Aktif kurucu',
    Admin: 'Aktif admin',
    Mod: 'Aktif mod',
    Rehber: 'Aktif rehber'
};

const STAFF = [
    { name: 'happaypatrickD', role: 'Kurucu' },
    { name: 'Mavzerina', role: 'Kurucu' },
    { name: 'HET', role: 'Admin' },
    { name: 'KimsesizMakina', role: 'Admin' },
    { name: 'KimsesizMaakina', role: 'Admin', alias: true },
    { name: 'aliakn', role: 'Mod' }
];

let toastTimer = null;
let statusFetching = false;
let statusTimer = null;
let statusFailCount = 0;
let pendingAuth = null;

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2400);
}

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach((section) => {
        section.classList.remove('active');
    });

    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
    }

    document.querySelectorAll('.nav-links a').forEach((link) => {
        link.style.fontWeight = '';
    });

    const activeLink = document.querySelector(`.nav-links a[href="#${sectionId}"]`);
    if (activeLink) {
        activeLink.style.fontWeight = '600';
    }

    closeMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMenu() {
    const navList = document.getElementById('nav-list');
    const menuToggle = document.getElementById('mobile-menu');
    if (!navList || !menuToggle) return;

    const isOpen = navList.classList.toggle('active');
    menuToggle.classList.toggle('is-active', isOpen);
    menuToggle.setAttribute('aria-expanded', String(isOpen));
}

function closeMenu() {
    const navList = document.getElementById('nav-list');
    const menuToggle = document.getElementById('mobile-menu');
    if (!navList || !menuToggle) return;

    navList.classList.remove('active');
    menuToggle.classList.remove('is-active');
    menuToggle.setAttribute('aria-expanded', 'false');
}

function applyTheme(theme, persist = false) {
    const dark = theme === 'dark';
    document.documentElement.classList.toggle('theme-dark', dark);

    const button = document.getElementById('themeToggle');
    if (button) {
        const label = button.querySelector('.theme-label');
        const icon = button.querySelector('i');
        const name = dark ? 'Beyaz' : 'Karanlık';
        const title = `${name} moda geç`;

        button.setAttribute('aria-label', title);
        button.setAttribute('title', title);
        if (label) label.textContent = name;
        if (icon) icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0d1510' : '#81c784');

    if (persist) {
        try {
            localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
        } catch (error) {}
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.contains('theme-dark');
    applyTheme(isDark ? 'light' : 'dark', true);
}

function readUsers() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_USERS_KEY)) || {};
    } catch (error) {
        return {};
    }
}

function writeUsers(users) {
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function getSession() {
    return localStorage.getItem(AUTH_SESSION_KEY);
}

async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

async function autoLoginOwner() {
    if (AUTH_SECURE_MODE) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('owner');
    if (token && (await sha256(token)) === OWNER_TOKEN_HASH) {
        localStorage.setItem(OWNER_AUTO_KEY, '1');
        params.delete('owner');
        const clean = window.location.pathname
            + (params.toString() ? `?${params.toString()}` : '')
            + window.location.hash;
        window.history.replaceState({}, document.title, clean);
    }

    if (localStorage.getItem(OWNER_AUTO_KEY) === '1') {
        localStorage.setItem(AUTH_SESSION_KEY, OWNER_NICK);
        ensureProfile(OWNER_NICK);
    }
}

function isReservedNick(nick) {
    return RESERVED_NICKS.includes(String(nick || '').trim().toLowerCase());
}

function readProfiles() {
    try {
        return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
    } catch (error) {
        return {};
    }
}

function writeProfiles(profiles) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
}

function ensureProfile(nick) {
    const key = nick.toLowerCase();
    const profiles = readProfiles();
    if (!profiles[key]) {
        profiles[key] = { bio: '', avatar: '⚔️', since: new Date().toISOString() };
        writeProfiles(profiles);
    }
    return profiles[key];
}

function renderProfile() {
    const nick = getSession();
    if (!nick) return;

    const profile = ensureProfile(nick);
    const nameEl = document.getElementById('profileName');
    const roleEl = document.getElementById('profileRole');
    const avatarEl = document.getElementById('profileAvatar');
    const sinceEl = document.getElementById('profileSince');
    const serverEl = document.getElementById('profileServerStatus');
    const bioEl = document.getElementById('profileBio');

    if (nameEl) nameEl.textContent = nick;
    if (roleEl) roleEl.textContent = isReservedNick(nick) ? 'Kurucu' : 'Oyuncu';
    if (avatarEl) avatarEl.textContent = profile.avatar || '⚔️';
    if (sinceEl) {
        const date = new Date(profile.since);
        sinceEl.textContent = Number.isNaN(date.getTime())
            ? '-'
            : date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    if (serverEl) {
        const status = document.getElementById('statusLabel')?.textContent || 'Kontrol ediliyor...';
        serverEl.textContent = status;
        serverEl.className = status === 'Açık' ? 'online' : 'offline';
    }
    if (bioEl) bioEl.value = profile.bio || '';

    document.querySelectorAll('#avatarPicker button').forEach((button) => {
        button.classList.toggle('active', button.dataset.avatar === (profile.avatar || '⚔️'));
    });
}

function saveProfile() {
    const nick = getSession();
    if (!nick) return;

    const profiles = readProfiles();
    const current = profiles[nick.toLowerCase()] || ensureProfile(nick);
    const bioEl = document.getElementById('profileBio');
    const activeAvatar = document.querySelector('#avatarPicker button.active');

    current.bio = (bioEl?.value || '').trim().slice(0, 120);
    current.avatar = activeAvatar?.dataset.avatar || current.avatar || '⚔️';
    profiles[nick.toLowerCase()] = current;
    writeProfiles(profiles);

    renderProfile();
    showToast('Profil kaydedildi.');
}

function selectAvatar(button) {
    document.querySelectorAll('#avatarPicker button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
}

function getDeviceId() {
    let deviceId = localStorage.getItem(AUTH_DEVICE_KEY);
    if (!deviceId) {
        deviceId = window.crypto?.randomUUID
            ? window.crypto.randomUUID()
            : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem(AUTH_DEVICE_KEY, deviceId);
    }
    return deviceId;
}

async function authApi(path, options = {}) {
    if (!AUTH_SECURE_MODE) throw new Error('Guvenli giris modu kapali.');

    const response = await fetch(`${AUTH_API_BASE.replace(/\/$/, '')}${path}`, {
        method: options.method || 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
}

function showCodeForm(message, meta = {}) {
    const form = document.getElementById('authCodeForm');
    const info = document.getElementById('authCodeInfo');
    const tabs = document.getElementById('authTabs');
    const loginForm = document.getElementById('authLoginForm');
    const registerForm = document.getElementById('authRegisterForm');
    const profile = document.getElementById('authProfile');
    const codeInput = document.getElementById('authCode');
    if (!form || !info || !tabs || !loginForm || !registerForm || !profile) return;

    pendingAuth = meta;
    document.getElementById('authOverlay').hidden = false;
    tabs.hidden = true;
    loginForm.hidden = true;
    registerForm.hidden = true;
    profile.hidden = true;
    form.hidden = false;
    info.textContent = message;
    if (codeInput) {
        codeInput.value = '';
        codeInput.focus();
    }
}

function getAuthLock() {
    try {
        return JSON.parse(sessionStorage.getItem(AUTH_LOCK_KEY)) || { fails: 0, until: 0 };
    } catch (error) {
        return { fails: 0, until: 0 };
    }
}

function setAuthLock(lock) {
    sessionStorage.setItem(AUTH_LOCK_KEY, JSON.stringify(lock));
}

function getAuthLockLeft() {
    const lock = getAuthLock();
    if (!lock.until) return 0;

    const left = Math.ceil((lock.until - Date.now()) / 1000);
    if (left <= 0) {
        setAuthLock({ fails: 0, until: 0 });
        return 0;
    }
    return left;
}

function resetAuthLock() {
    setAuthLock({ fails: 0, until: 0 });
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

async function hashPassword(password) {
    if (window.crypto && window.crypto.subtle) {
        const bytes = new TextEncoder().encode(password);
        const digest = await window.crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    let hash = 0;
    for (const char of password) {
        hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    }
    return `local_${hash}`;
}

function updateAuthUI() {
    const button = document.getElementById('authNavButton');
    if (!button) return;

    const user = getSession();
    if (user) {
        button.innerHTML = `<i class="fa-solid fa-user"></i> ${escapeHtml(user)}`;
        button.title = 'Profilini görüntüle / çıkış yap';
    } else {
        button.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Giriş Yap';
        button.title = 'Giriş yap veya kayıt ol';
    }
}

function switchAuth(mode) {
    const overlay = document.getElementById('authOverlay');
    const tabs = document.getElementById('authTabs');
    const loginForm = document.getElementById('authLoginForm');
    const registerForm = document.getElementById('authRegisterForm');
    const codeForm = document.getElementById('authCodeForm');
    const profile = document.getElementById('authProfile');
    const loginTab = document.getElementById('authTabLogin');
    const registerTab = document.getElementById('authTabRegister');
    if (!overlay || !tabs || !loginForm || !registerForm || !profile) return;

    pendingAuth = null;
    overlay.hidden = false;
    tabs.hidden = false;
    profile.hidden = true;
    if (codeForm) codeForm.hidden = true;

    const isLogin = mode !== 'register';
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
    loginTab.classList.toggle('active', isLogin);
    registerTab.classList.toggle('active', !isLogin);
}

function showProfile() {
    const overlay = document.getElementById('authOverlay');
    const tabs = document.getElementById('authTabs');
    const loginForm = document.getElementById('authLoginForm');
    const registerForm = document.getElementById('authRegisterForm');
    const codeForm = document.getElementById('authCodeForm');
    const profile = document.getElementById('authProfile');
    const name = document.getElementById('profileName');
    if (!overlay || !tabs || !loginForm || !registerForm || !profile) return;

    pendingAuth = null;
    overlay.hidden = false;
    tabs.hidden = true;
    loginForm.hidden = true;
    registerForm.hidden = true;
    if (codeForm) codeForm.hidden = true;
    profile.hidden = false;
    if (name) name.textContent = getSession() || '-';
    renderProfile();
}

function openAuth(mode = 'login') {
    if (getSession()) {
        showProfile();
    } else {
        switchAuth(mode);
    }
}

function closeAuth() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) overlay.hidden = true;
}

async function handleLogin(event) {
    event.preventDefault();

    // Giris yapilmissa kurucu uyarisini gosterme, profili ac.
    if (getSession()) {
        showProfile();
        return;
    }

    const loginNickCheck = document.getElementById('loginNick').value.trim();
    if (isReservedNick(loginNickCheck)) {
        showToast('Bu hesap kurucuya aittir. Giriş yapılamaz.');
        return;
    }

    if (AUTH_SECURE_MODE) {
        const nick = document.getElementById('loginNick').value.trim();
        const pass = document.getElementById('loginPass').value;

        try {
            const data = await authApi('/api/login', {
                body: { nick, password: pass, deviceId: getDeviceId() }
            });

            if (data.needsCode) {
                showCodeForm(`Yeni cihaz veya IP değişikliği algılandı. Kod ${data.emailHint} adresine gönderildi.`, {
                    type: 'login',
                    challenge: data.challenge,
                    nick: data.nick
                });
                return;
            }

            ensureProfile(data.nick);
            localStorage.setItem(AUTH_SESSION_KEY, data.nick);
            updateAuthUI();
            closeAuth();
            showToast(`Hoş geldin, ${data.nick}!`);
        } catch (error) {
            showToast(error.message || 'Giriş başarısız.');
        }
        return;
    }

    const lockLeft = getAuthLockLeft();
    if (lockLeft > 0) {
        showToast(`Çok fazla deneme oldu, ${lockLeft} saniye bekle.`);
        return;
    }

    const nick = document.getElementById('loginNick').value.trim();
    const pass = document.getElementById('loginPass').value;
    const users = readUsers();
    const entry = users[nick.toLowerCase()];

    if (!entry || entry.hash !== await hashPassword(pass)) {
        const lock = getAuthLock();
        lock.fails += 1;
        if (lock.fails >= AUTH_MAX_FAILS) {
            lock.until = Date.now() + AUTH_LOCK_MS;
            lock.fails = 0;
            showToast('Çok fazla yanlış deneme. 30 saniye beklesen iyi olur.');
        } else {
            showToast('Oyuncu adı veya şifre yanlış.');
        }
        setAuthLock(lock);
        return;
    }

    resetAuthLock();
    localStorage.setItem(AUTH_SESSION_KEY, entry.nick);
    updateAuthUI();
    closeAuth();
    showToast(`Hoş geldin, ${entry.nick}!`);
}

async function handleRegister(event) {
    event.preventDefault();

    const registerNickCheck = document.getElementById('registerNick').value.trim();
    if (isReservedNick(registerNickCheck)) {
        showToast('Bu oyuncu adı kurucuya aittir, kayıt alınamaz.');
        return;
    }

    if (AUTH_SECURE_MODE) {
        const nick = document.getElementById('registerNick').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const pass = document.getElementById('registerPass').value;
        const pass2 = document.getElementById('registerPass2').value;

        if (!/^[A-Za-z0-9_]{3,16}$/.test(nick)) {
            showToast('Oyuncu adı 3-16 karakter, sadece harf/rakam/_ olabilir.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showToast('Geçerli bir e-posta adresi gir.');
            return;
        }
        if (pass.length < 8) {
            showToast('Şifre en az 8 karakter olmalı.');
            return;
        }
        if (pass !== pass2) {
            showToast('Şifreler eşleşmiyor.');
            return;
        }

        try {
            const data = await authApi('/api/register', {
                body: { nick, email, password: pass }
            });
            showCodeForm(`Doğrulama kodu ${data.emailHint} adresine gönderildi.`, {
                type: 'email',
                nick: data.nick,
                emailHint: data.emailHint
            });
        } catch (error) {
            showToast(error.message || 'Kayıt başarısız.');
        }
        return;
    }

    const nick = document.getElementById('registerNick').value.trim();
    const pass = document.getElementById('registerPass').value;
    const pass2 = document.getElementById('registerPass2').value;
    const users = readUsers();

    if (!/^[A-Za-z0-9_]{3,16}$/.test(nick)) {
        showToast('Oyuncu adı 3-16 karakter, sadece harf/rakam/_ olabilir.');
        return;
    }
    if (pass.length < 4) {
        showToast('Şifre en az 4 karakter olmalı.');
        return;
    }
    if (pass !== pass2) {
        showToast('Şifreler eşleşmiyor.');
        return;
    }
    if (users[nick.toLowerCase()]) {
        showToast('Bu oyuncu adı zaten kayıtlı.');
        return;
    }

    users[nick.toLowerCase()] = { nick, hash: await hashPassword(pass), createdAt: new Date().toISOString() };
    writeUsers(users);
    ensureProfile(nick);
    localStorage.setItem(AUTH_SESSION_KEY, nick);
    updateAuthUI();
    closeAuth();
    showToast(`Kayıt tamam, hoş geldin ${nick}!`);
}

async function logout() {
    if (AUTH_SECURE_MODE) {
        try {
            await authApi('/api/logout');
        } catch (error) {
            // Yerli oturum yine de temizlenir.
        }
    }

    localStorage.removeItem(AUTH_SESSION_KEY);
    pendingAuth = null;
    updateAuthUI();
    closeAuth();
    showToast('Çıkış yapıldı.');
}

async function handleCodeSubmit(event) {
    event.preventDefault();
    if (!pendingAuth) return;

    const code = document.getElementById('authCode').value.trim();
    if (!/^\d{6}$/.test(code)) {
        showToast('6 haneli kodu gir.');
        return;
    }

    try {
        if (pendingAuth.type === 'email') {
            await authApi('/api/verify-email', { body: { nick: pendingAuth.nick, code } });
            pendingAuth = null;
            switchAuth('login');
            showToast('E-postan doğrulandı. Şimdi giriş yapabilirsin.');
            return;
        }

        const data = await authApi('/api/verify', {
            body: {
                challenge: pendingAuth.challenge,
                code,
                deviceId: getDeviceId()
            }
        });

        ensureProfile(data.nick);
        localStorage.setItem(AUTH_SESSION_KEY, data.nick);
        pendingAuth = null;
        updateAuthUI();
        closeAuth();
        showToast(`Hoş geldin, ${data.nick}! Bu cihaz artık güvenilir.`);
    } catch (error) {
        showToast(error.message || 'Kod doğrulanamadı.');
    }
}

async function restoreSecureSession() {
    if (!AUTH_SECURE_MODE) return;

    try {
        const data = await authApi('/api/me', { method: 'GET' });
        if (data.nick) {
            ensureProfile(data.nick);
            localStorage.setItem(AUTH_SESSION_KEY, data.nick);
        } else {
            localStorage.removeItem(AUTH_SESSION_KEY);
        }
        updateAuthUI();
    } catch (error) {
        // Çerez yoksa kullanıcı giriş ekranında kalır.
    }
}

async function copyServerIp() {
    try {
        await navigator.clipboard.writeText(SERVER_IP);
        showToast(`IP kopyalandı: ${SERVER_IP}`);
    } catch (error) {
        const input = document.createElement('textarea');
        input.value = SERVER_IP;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
        showToast(`IP kopyalandı: ${SERVER_IP}`);
    }
}

function updateStaffStatus(onlineNames) {
    const box = document.getElementById('staffStatus');
    const text = document.getElementById('staffStatusText');
    if (!box || !text) return;

    const active = STAFF.filter((member) => onlineNames.has(member.name.toLowerCase()));

    if (active.length === 0) {
        text.textContent = 'Şu an aktif kurucu/admin/mod/rehber yok.';
        box.classList.remove('active');
        return;
    }

    const parts = STAFF_ROLES
        .map((role) => ({
            role,
            names: active.filter((member) => member.role === role).map((member) => member.name)
        }))
        .filter((group) => group.names.length > 0)
        .map((group) => `${STAFF_ROLE_LABELS[group.role]}: ${group.names.join(', ')}`);

    text.textContent = parts.join(' | ');
    box.classList.add('active');
}

function renderStaffRoster() {
    const roster = document.getElementById('staffRoster');
    if (!roster) return;

    roster.innerHTML = STAFF_ROLES.map((role) => {
        const names = STAFF
            .filter((member) => member.role === role && !member.alias)
            .map((member) => member.name);
        const value = names.length ? names.join(', ') : 'Şu an atama yok';
        const empty = names.length === 0 ? ' is-empty' : '';
        return `<div class="staff-roster-row${empty}"><span class="staff-roster-role">${role}</span><span class="staff-roster-names">${value}</span></div>`;
    }).join('');
}

function setServerStatus(online, onlineCount = null, maxCount = null, unavailable = false, cached = false) {
    const bar = document.getElementById('statusBar');
    const dot = document.getElementById('statusDot');
    const label = document.getElementById('statusLabel');
    const players = document.getElementById('playerCount');
    if (!bar || !dot || !label || !players) return;

    const state = online ? 'open' : 'closed';
    bar.dataset.state = state;

    dot.className = `status-dot ${online ? 'online' : 'offline'}`;
    label.className = `status-value ${state}`;
    label.textContent = online ? 'Açık' : 'Kapalı';

    if (online && Number.isFinite(onlineCount) && Number.isFinite(maxCount)) {
        players.textContent = `Oyuncu: ${onlineCount}/${maxCount}`;
    } else {
        players.textContent = 'Oyuncu: --';
    }

    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    bar.title = unavailable
        ? `Durum servisine ulaşılamadı (${time}). Son bilgi kapalı kabul edildi.`
        : cached
            ? `Son kontrol: ${time} (önbellekten)`
            : `Son kontrol: ${time}`;
}

function readStatusCache() {
    try {
        const raw = JSON.parse(localStorage.getItem(STATUS_CACHE_KEY));
        if (!raw || !Number.isFinite(raw.fetchedAt)) return null;
        return raw;
    } catch (error) {
        return null;
    }
}

function applyStatusCache(cache, cached = true) {
    setServerStatus(cache.online === true, cache.onlineCount, cache.maxCount, false, cached);
    updateStaffStatus(new Set((cache.names || []).map((name) => String(name).toLowerCase())));
}

function scheduleStatusUpdate() {
    if (statusTimer) clearTimeout(statusTimer);
    const delay = statusFailCount >= 2 ? 5 * 60 * 1000 : STATUS_REFRESH_MS;
    statusTimer = setTimeout(() => updateServerStatus(true), delay);
}

async function updateServerStatus(force = false) {
    if (statusFetching) return;
    statusFetching = true;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const cache = readStatusCache();
        if (!force && cache && Date.now() - cache.fetchedAt < STATUS_CACHE_MS) {
            applyStatusCache(cache);
            return;
        }

        const response = await fetch(STATUS_API, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const playerList = Array.isArray(data.players?.list) ? data.players.list : [];
        const names = playerList.map((player) => String(player.name || '').toLowerCase());

        setServerStatus(data.online === true, data.players?.online, data.players?.max);
        updateStaffStatus(new Set(names));

        localStorage.setItem(STATUS_CACHE_KEY, JSON.stringify({
            online: data.online === true,
            onlineCount: data.players?.online ?? null,
            maxCount: data.players?.max ?? null,
            names,
            fetchedAt: Date.now()
        }));

        statusFailCount = 0;
        localStorage.removeItem(STATUS_FAILS_KEY);
    } catch (error) {
        statusFailCount = Number(localStorage.getItem(STATUS_FAILS_KEY) || 0) + 1;
        localStorage.setItem(STATUS_FAILS_KEY, String(statusFailCount));

        const stale = readStatusCache();
        if (stale) {
            applyStatusCache(stale);
        } else {
            setServerStatus(false, null, null, true);
            updateStaffStatus(new Set());
        }
    } finally {
        clearTimeout(timeout);
        statusFetching = false;
        scheduleStatusUpdate();
    }
}

function toggleMusic() {
    const music = document.getElementById('bgMusic');
    const button = document.getElementById('musicToggle');
    if (!music || !button) return;

    if (music.paused) {
        music.volume = 0.22;
        music.play()
            .then(() => {
                button.innerHTML = '<i class="fa-solid fa-pause"></i> Durdur';
            })
            .catch(() => {
                showToast('Müzik dosyası eklenmedi: assets/huzursmp-theme.mp3');
            });
    } else {
        music.pause();
        button.innerHTML = '<i class="fa-solid fa-play"></i> Başlat';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    let savedTheme = 'light';
    try {
        savedTheme = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
    } catch (error) {}
    applyTheme(savedTheme);

    const year = document.getElementById('year');
    if (year) {
        year.textContent = String(new Date().getFullYear());
    }

    const mainIp = document.getElementById('serverIpMain');
    if (mainIp) {
        mainIp.addEventListener('click', copyServerIp);
    }

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        if (!target.closest('.navbar')) {
            closeMenu();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeAuth();
    });

    const authNote = document.querySelector('.auth-note');
    if (authNote && AUTH_SECURE_MODE) {
        authNote.textContent = 'Yeni cihaz veya IP değişikliğinde doğrulama kodu e-posta adresine gönderilir.';
        const registerPass = document.getElementById('registerPass');
        if (registerPass) registerPass.placeholder = 'En az 8 karakter';
    }

    await autoLoginOwner();
    updateAuthUI();
    restoreSecureSession();
    updateServerStatus();

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateServerStatus();
    });
});
