/* ── TrustID API Service ── */
const Api = (() => {
  /* Auto-detect base URL: full URL for Capacitor/native, relative for web */
  const isNative = typeof window !== 'undefined' && (
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
    window.location.hostname === 'localhost' && window.Capacitor
  );
  const BASE = isNative
    ? (localStorage.getItem('tid_api_url') || 'https://trustid-realtime.onrender.com/api/trustid')
    : '/api/trustid';

  const req = async (method, path, body) => {
    const token = Auth.getToken();
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    if (body != null) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(BASE + path, opts);
      const data = await res.json();
      /* Auto-logout on 401 */
      if (res.status === 401 && !path.includes('/auth/login')) {
        Auth.logout();
        return { success: false, message: 'Session expired' };
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message || 'Network error' };
    }
  };

  return {
    /* ── Auth ── */
    login:          (email, password)   => req('POST', '/auth/login',           { email, password }),
    register:       (form)              => req('POST', '/auth/register',         form),
    changePassword: (cur, nw)           => req('PUT',  '/auth/change-password',  { currentPassword: cur, newPassword: nw }),
    seedAdmin:      ()                  => req('POST', '/auth/seed-admin'),

    /* ── Documents ── */
    getDocs:    ()         => req('GET',  '/documents'),
    uploadDoc:  (body)     => req('POST', '/documents',          body),
    getAllDocs:  ()         => req('GET',  '/documents/all'),
    verifyDoc:  (id)       => req('PUT',  `/documents/${id}/verify`),
    rejectDoc:  (id, r)    => req('PUT',  `/documents/${id}/reject`, { reason: r }),

    /* ── Expenses ── */
    getExpenses:   ()     => req('GET',    '/expenses'),
    addExpense:    (body) => req('POST',   '/expenses',       body),
    deleteExpense: (id)   => req('DELETE', `/expenses/${id}`),

    /* ── Reminders ── */
    getReminders:   ()         => req('GET',    '/reminders'),
    addReminder:    (body)     => req('POST',   '/reminders',        body),
    updateReminder: (id, body) => req('PUT',    `/reminders/${id}`,  body),
    deleteReminder: (id)       => req('DELETE', `/reminders/${id}`),

    /* ── Todos ── */
    getTodos:   ()         => req('GET',    '/todos'),
    addTodo:    (body)     => req('POST',   '/todos',        body),
    updateTodo: (id, body) => req('PUT',    `/todos/${id}`,  body),
    deleteTodo: (id)       => req('DELETE', `/todos/${id}`),

    /* ── Admin ── */
    getAdminUsers: () => req('GET', '/admin/users'),
    getAdminStats: () => req('GET', '/admin/stats'),
  };
})();
