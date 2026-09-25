const API = '/api';

function token() {
  return localStorage.getItem('token');
}

async function api(path, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    10000
  );

  try {
    opts.headers = {
      ...(opts.headers || {}),
      'Content-Type': 'application/json',
      ...(token()
        ? {
            Authorization: `Bearer ${token()}`
          }
        : {})
    };

    opts.signal = controller.signal;

    const r = await fetch(API + path, opts);

    let d = {};

    try {
      d = await r.json();
    } catch {}

    if (!r.ok) {
      throw new Error(
        d.error ||
        d.detail ||
        `HTTP ${r.status}`
      );
    }

    return d;

  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(
        'เซิร์ฟเวอร์ใช้เวลาตอบนานเกินไป'
      );
    }

    if (e instanceof TypeError) {
      throw new Error(
        'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบ npm start'
      );
    }

    throw e;

  } finally {
    clearTimeout(timer);
  }
}

function logout() {
  localStorage.clear();
  location.href = '/login.html';
}

function requireRole(role) {
  const u = JSON.parse(
    localStorage.getItem('user') || 'null'
  );

  if (
    !u ||
    !token() ||
    u.role !== role
  ) {
    location.href = '/login.html';
    return null;
  }

  return u;
}

function esc(s) {
  return String(s ?? '').replace(
    /[&<>'"]/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[c])
  );
}
