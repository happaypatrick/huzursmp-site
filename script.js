const SERVER_IP = 'fried-latch.tun.ply.gg';
const STATUS_API = `https://api.mcsrvstat.us/3/${SERVER_IP}`;
const STATUS_REFRESH_MS = 60000;
const AUTH_USERS_KEY = 'huzursmp_site_users';
const AUTH_SESSION_KEY = 'huzursmp_site_session';

const STAFF = [
    { name: 'happaypatrickD', role: 'Kurucu' },
    { name: 'Mavzerina', role: 'Kurucu' },
    { name: 'HET', role: 'Admin' },
    { name: 'KimsesizMaakina', role: 'Admin' }
];

let toastTimer = null;

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
        button.title = 'Hesabını görüntüle / çıkış yap';
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
    const profile = document.getElementById('authProfile');
    const loginTab = document.getElementById('authTabLogin');
    const registerTab = document.getElementById('authTabRegister');
    if (!overlay || !tabs || !loginForm || !registerForm || !profile) return;

    overlay.hidden = false;
    tabs.hidden = false;
    profile.hidden = true;

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
    const profile = document.getElementById('authProfile');
    const name = document.getElementById('profileName');
    if (!overlay || !tabs || !loginForm || !registerForm || !profile) return;

    overlay.hidden = false;
    tabs.hidden = true;
    loginForm.hidden = true;
    registerForm.hidden = true;
    profile.hidden = false;
    if (name) name.textContent = getSession() || '-';
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

    const nick = document.getElementById('loginNick').value.trim();
    const pass = document.getElementById('loginPass').value;
    const users = readUsers();
    const entry = users[nick.toLowerCase()];

    if (!entry || entry.hash !== await hashPassword(pass)) {
        showToast('Oyuncu adı veya şifre yanlış.');
        return;
    }

    localStorage.setItem(AUTH_SESSION_KEY, entry.nick);
    updateAuthUI();
    closeAuth();
    showToast(`Hoş geldin, ${entry.nick}!`);
}

async function handleRegister(event) {
    event.preventDefault();

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

    users[nick.toLowerCase()] = { nick, hash: await hashPassword(pass) };
    writeUsers(users);
    localStorage.setItem(AUTH_SESSION_KEY, nick);
    updateAuthUI();
    closeAuth();
    showToast(`Kayıt tamam, hoş geldin ${nick}!`);
}

function logout() {
    localStorage.removeItem(AUTH_SESSION_KEY);
    updateAuthUI();
    closeAuth();
    showToast('Çıkış yapıldı.');
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
        text.textContent = 'Şu an aktif kurucu/admin yok.';
        box.classList.remove('active');
        return;
    }

    const founders = active.filter((member) => member.role === 'Kurucu').map((member) => member.name);
    const admins = active.filter((member) => member.role === 'Admin').map((member) => member.name);
    const parts = [];

    if (founders.length) parts.push(`Aktif kurucu: ${founders.join(', ')}`);
    if (admins.length) parts.push(`Aktif admin: ${admins.join(', ')}`);

    text.textContent = parts.join(' | ');
    box.classList.add('active');
}

function setServerStatus(online, onlineCount = null, maxCount = null, unavailable = false) {
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
        : `Son kontrol: ${time}`;
}

async function updateServerStatus() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(STATUS_API, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        setServerStatus(
            data.online === true,
            data.players?.online,
            data.players?.max
        );

        const playerList = Array.isArray(data.players?.list) ? data.players.list : [];
        const onlineNames = new Set(playerList.map((player) => String(player.name || '').toLowerCase()));
        updateStaffStatus(onlineNames);
    } catch (error) {
        setServerStatus(false, null, null, true);
        updateStaffStatus(new Set());
    } finally {
        clearTimeout(timeout);
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

document.addEventListener('DOMContentLoaded', () => {
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

    updateAuthUI();
    updateServerStatus();
    setInterval(updateServerStatus, STATUS_REFRESH_MS);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateServerStatus();
    });
});
