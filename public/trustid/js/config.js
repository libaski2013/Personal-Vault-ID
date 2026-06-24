/* Personal Vault runtime config shared by web and Android WebView. */
var PV = (function () {
  var REMOTE_ORIGIN = 'https://trustid-realtime.onrender.com';

  function isLocalOrigin() {
    var h = window.location.hostname;
    return window.location.protocol === 'file:' ||
      window.location.protocol === 'capacitor:' ||
      h === 'localhost' || h === '127.0.0.1' || h === '';
  }

  function origin() {
    var override = localStorage.getItem('pv_api_origin');
    if (override) return override.replace(/\/$/, '');
    return isLocalOrigin() ? REMOTE_ORIGIN : window.location.origin;
  }

  function url(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return origin() + (path.charAt(0) === '/' ? path : '/' + path);
  }

  function fetchApi(path, opts) {
    return fetch(url(path), opts);
  }

  return {
    origin: origin,
    url: url,
    apiUrl: url,
    fetch: fetchApi,
    socketOrigin: origin,
  };
})();
