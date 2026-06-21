/* ── TrustID Auth Helper ── */
/* Uses var so it is accessible from every other <script> tag */
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
      window.location.href = '/trustid/login.html';
    },

    requireAuth: function () {
      if (!localStorage.getItem(TOKEN_KEY)) {
        window.location.replace('/trustid/login.html');
        return false;
      }
      return true;
    },

    requireAdmin: function () {
      if (!localStorage.getItem(TOKEN_KEY)) {
        window.location.replace('/trustid/login.html');
        return false;
      }
      try {
        var user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
        if (!user || user.role !== 'admin') {
          window.location.replace('/trustid/dashboard.html');
          return false;
        }
      } catch (e) {
        window.location.replace('/trustid/login.html');
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
              ? '/trustid/admin/dashboard.html'
              : '/trustid/dashboard.html'
          );
        } catch (e) {
          window.location.replace('/trustid/dashboard.html');
        }
        return false;
      }
      return true;
    },
  };
})();
