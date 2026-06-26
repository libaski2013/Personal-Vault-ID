/* ── TrustID Auth Helper ── */
/* Uses var so it is accessible from every other <script> tag */
var PV = window.PV || (window.PV = {});
PV.BACKEND_ORIGIN = PV.BACKEND_ORIGIN || 'https://personal-vault-id.onrender.com';
PV.isNative = PV.isNative || function () {
  var h = window.location.hostname;
  return !!window.Capacitor ||
    /^(capacitor|ionic|file):$/.test(window.location.protocol) ||
    ((h === 'localhost' || h === '127.0.0.1' || h === '') && /Android/i.test(navigator.userAgent || ''));
};
PV.origin = PV.origin || function () {
  var override = localStorage.getItem('pv_api_origin');
  if (override) return override.replace(/\/$/, '');
  return PV.isNative() ? PV.BACKEND_ORIGIN : window.location.origin;
};
PV.url = PV.url || function (path) {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.charAt(0) !== '/') path = '/' + path;
  return PV.origin() + path;
};
PV.fetch = PV.fetch || function (path, opts) {
  opts = opts || {};
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = null;
  if (controller) {
    timer = setTimeout(function () { controller.abort(); }, 60000);
    opts.signal = controller.signal;
  }
  return fetch(PV.url(path), opts).finally(function () {
    if (timer) clearTimeout(timer);
  });
};
PV.appPath = PV.appPath || function (path) {
  if (PV.isNative() && path.charAt(0) === '/') {
    return path.replace(/^\/trustid/, '') || '/index.html';
  }
  return path;
};

/* Native WebViews can resolve /api against capacitor://localhost. Keep every API call on the central backend. */
(function () {
  if (window.__pvFetchPatched) return;
  window.__pvFetchPatched = true;
  var originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.indexOf('/api/') === 0) {
      input = PV.url(input);
    } else if (input && typeof input.url === 'string' && input.url.indexOf('/api/') === 0) {
      input = new Request(PV.url(input.url), input);
    }
    return originalFetch(input, init);
  };
})();

var Auth = (function () {
  var TOKEN_KEY = 'tid_token';
  var USER_KEY  = 'tid_user';

  return {
    getToken: function () { return localStorage.getItem(TOKEN_KEY); },

    getUser: function () {
      try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
      catch (e) { return null; }
    },

    setSession: function (token, user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },

    clear: function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },

    logout: function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.href = PV.appPath('/trustid/login.html');
    },

    requireAuth: function () {
      if (!localStorage.getItem(TOKEN_KEY)) {
        window.location.replace(PV.appPath('/trustid/login.html'));
        return false;
      }
      return true;
    },

    requireAdmin: function () {
      if (!localStorage.getItem(TOKEN_KEY)) {
        window.location.replace(PV.appPath('/trustid/login.html'));
        return false;
      }
      try {
        var user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
        if (!user || user.role !== 'admin') {
          window.location.replace(PV.appPath('/trustid/dashboard.html'));
          return false;
        }
      } catch (e) {
        window.location.replace(PV.appPath('/trustid/login.html'));
        return false;
      }
      return true;
    },

    requireGuest: function () {
      if (localStorage.getItem(TOKEN_KEY)) {
        try {
          var user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
          window.location.replace(
            user && user.role === 'admin'
              ? PV.appPath('/trustid/admin/dashboard.html')
              : PV.appPath(PV.isNative() ? '/trustid/mobile-home.html' : '/trustid/dashboard.html')
          );
        } catch (e) {
          window.location.replace(PV.appPath(PV.isNative() ? '/trustid/mobile-home.html' : '/trustid/dashboard.html'));
        }
        return false;
      }
      return true;
    },
  };
})();
