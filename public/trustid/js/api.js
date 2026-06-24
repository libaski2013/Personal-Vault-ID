/* ── TrustID API Service ── */
/* Uses var so it is accessible from every other <script> tag */
var Api = (function () {
  var BASE = '/api/trustid';

  function req(method, path, body) {
    var token = Auth.getToken();
    var opts = {
      method: method,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        token ? { Authorization: 'Bearer ' + token } : {}
      ),
    };
    if (body != null) opts.body = JSON.stringify(body);
    return fetch((window.PV && PV.url ? PV.url(BASE + path) : BASE + path), opts)
      .then(function (res) {
        if (res.status === 401 && path.indexOf('/auth/login') === -1) {
          Auth.logout();
          return { success: false, message: 'Session expired' };
        }
        return res.json();
      })
      .catch(function (err) {
        return { success: false, message: err.message || 'Network error' };
      });
  }

  return {
    /* ── Auth ── */
    login:          function (email, password) { return req('POST', '/auth/login',          { email: email, password: password }); },
    register:       function (form)            { return req('POST', '/auth/register',        form); },
    requestPasswordReset: function (body)       { return req('POST', '/auth/request-password-reset', body); },
    resetPassword:  function (body)             { return req('POST', '/auth/reset-password', body); },
    changePassword: function (cur, nw)         { return req('PUT',  '/auth/change-password', { currentPassword: cur, newPassword: nw }); },
    updatePhone:    function (phone)           { return req('PUT',  '/auth/phone', { phone: phone }); },
    updateProfile:  function (body)            { return req('PUT',  '/auth/profile', body); },
    seedAdmin:      function ()                { return req('POST', '/auth/seed-admin'); },

    /* ── Documents ── */
    getDocs:   function ()        { return req('GET',    '/documents'); },
    uploadDoc: function (body)    { return req('POST',   '/documents', body); },
    getAllDocs: function ()        { return req('GET',    '/documents/all'); },
    verifyDoc: function (id)      { return req('PUT',    '/documents/' + id + '/verify'); },
    rejectDoc: function (id, r)   { return req('PUT',    '/documents/' + id + '/reject', { reason: r }); },

    /* ── Expenses ── */
    getExpenses:   function ()     { return req('GET',    '/expenses'); },
    addExpense:    function (body) { return req('POST',   '/expenses', body); },
    deleteExpense: function (id)   { return req('DELETE', '/expenses/' + id); },

    /* ── Reminders ── */
    getReminders:   function ()         { return req('GET',    '/reminders'); },
    addReminder:    function (body)     { return req('POST',   '/reminders', body); },
    updateReminder: function (id, body) { return req('PUT',    '/reminders/' + id, body); },
    deleteReminder: function (id)       { return req('DELETE', '/reminders/' + id); },

    /* ── Todos ── */
    getTodos:   function ()         { return req('GET',    '/todos'); },
    addTodo:    function (body)     { return req('POST',   '/todos', body); },
    updateTodo: function (id, body) { return req('PUT',    '/todos/' + id, body); },
    deleteTodo: function (id)       { return req('DELETE', '/todos/' + id); },

    /* ── Admin ── */
    getAdminUsers: function () { return req('GET', '/admin/users'); },
    getAdminStats: function () { return req('GET', '/admin/stats'); },

    /* ── Anonymous Social Network ── */
    socialOn:     function (zone)       { return req('POST', '/social/discovery/on', { zone: zone || 'nearby' }); },
    socialOff:    function ()           { return req('POST', '/social/discovery/off'); },
    socialNearby: function (zone)       { return req('GET',  '/social/nearby?zone=' + encodeURIComponent(zone || 'nearby')); },
    socialChats:  function ()           { return req('GET',  '/social/chats'); },
    socialStart:  function (token)      { return req('POST', '/social/chats', { token: token }); },
    socialSend:   function (id, text)   { return req('POST', '/social/chats/' + id + '/messages', { text: text }); },
    socialDisconnect: function (id)     { return req('POST', '/social/chats/' + id + '/disconnect'); },
    socialReport: function (id, reason) { return req('POST', '/social/chats/' + id + '/report', { reason: reason }); },
    socialBlock:  function (token)      { return req('POST', '/social/block/' + encodeURIComponent(token)); },

    /* ── Calendar ── */
    getCalendarEvents: function ()      { return req('GET', '/calendar/events'); },
    addCalendarEvent: function (body)   { return req('POST', '/calendar/events', body); },
    deleteCalendarEvent: function (id)  { return req('DELETE', '/calendar/events/' + id); },
  };
})();
