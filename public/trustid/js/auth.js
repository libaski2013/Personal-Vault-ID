/* ── TrustID Auth Helper ── */
const Auth = (() => {
  const TOKEN_KEY = 'tid_token';
  const USER_KEY  = 'tid_user';

  return {
    getToken: () => localStorage.getItem(TOKEN_KEY),

    getUser: () => {
      try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
      catch { return null; }
    },

    setSession: (token, user) => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },

    clear: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },

    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.href = '/trustid/login.html';
    },

    /* Redirect to login if no token */
    requireAuth: () => {
      if (!localStorage.getItem(TOKEN_KEY)) {
        window.location.replace('/trustid/login.html');
        return false;
      }
      return true;
    },

    /* Redirect to login if not admin */
    requireAdmin: () => {
      if (!localStorage.getItem(TOKEN_KEY)) {
        window.location.replace('/trustid/login.html');
        return false;
      }
      try {
        const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
        if (!user || user.role !== 'admin') {
          window.location.replace('/trustid/dashboard.html');
          return false;
        }
      } catch { window.location.replace('/trustid/login.html'); return false; }
      return true;
    },

    /* Redirect logged-in users away from auth pages */
    requireGuest: () => {
      if (localStorage.getItem(TOKEN_KEY)) {
        try {
          const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
          window.location.replace(user && user.role === 'admin'
            ? '/trustid/admin/dashboard.html'
            : '/trustid/dashboard.html');
        } catch { window.location.replace('/trustid/dashboard.html'); }
        return false;
      }
      return true;
    },
  };
})();
