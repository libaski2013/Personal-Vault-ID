/* ── Personal Vault — Shared Layout ── */
var Layout = (function () {

  /* ══ NAV GROUPS (collapsible) ══ */
  var GROUPS = [
    {
      id:    'identity',
      label: '📋 Identity',
      items: [
        { id:'dashboard', icon:'🏠', label:'Dashboard',   href:'/trustid/dashboard.html' },
        { id:'identity',  icon:'🛡️', label:'My Identity', href:'/trustid/certificate.html' },
        { id:'documents', icon:'📁', label:'Documents',   href:'/trustid/documents.html' },
        { id:'academics', icon:'🎓', label:'Academics',   href:'/trustid/academics.html' },
      ],
    },
    {
      id:    'life',
      label: '📖 My Life',
      items: [
        { id:'lifestory', icon:'📖', label:'Life Story',  href:'/trustid/lifestory.html' },
        { id:'expenses',  icon:'💰', label:'Expenses',    href:'/trustid/expenses.html' },
        { id:'reminders', icon:'🔔', label:'Reminders',   href:'/trustid/reminders.html' },
        { id:'todo',      icon:'✅', label:'To-Do',       href:'/trustid/todo.html' },
        { id:'calendar',  icon:'📅', label:'Calendar',    href:'/trustid/calendar.html' },
      ],
    },
    {
      id:    'private',
      label: '🔐 Private',
      items: [
        { id:'address', icon:'🏠', label:'My Address',    href:'/trustid/address.html' },
        { id:'vault',   icon:'🔐', label:'Secret Vault',  href:'/trustid/vault.html' },
        { id:'album',   icon:'🖼️', label:'Secret Album',  href:'/trustid/album.html' },
        { id:'legacy',  icon:'⏳', label:'Digital Legacy',href:'/trustid/legacy.html' },
      ],
    },
    {
      id:    'connect',
      label: '💬 Connect',
      items: [
        { id:'chat',  icon:'💬', label:'Messages',      href:'/trustid/chat.html' },
        { id:'share', icon:'📤', label:'Share My Vault',href:'/trustid/share.html' },
      ],
    },
  ];

  var ADMIN_GROUPS = [
    {
      id:    'admin',
      label: '⚙️ Admin',
      items: [
        { id:'admin-dashboard', icon:'📊', label:'Overview',           href:'/trustid/admin/dashboard.html' },
        { id:'admin-users',     icon:'👥', label:'Users',              href:'/trustid/admin/users.html' },
        { id:'admin-docs',      icon:'📋', label:'Verification Queue', href:'/trustid/admin/docs.html' },
        { id:'admin-trustids',  icon:'🛡️', label:'ID Registry',       href:'/trustid/admin/trustids.html' },
        { id:'admin-features',  icon:'🔧', label:'Feature Control',    href:'/trustid/admin/features.html' },
      ],
    },
  ];

  var BOT_NAV = [
    { id:'profile',  icon:'👤', label:'Profile',  href:'/trustid/profile.html' },
    { id:'settings', icon:'⚙️', label:'Settings', href:'/trustid/settings.html' },
  ];

  /* Bottom nav (mobile) — 5 most-used items */
  var BOTTOM_NAV = [
    { id:'dashboard', icon:'🏠', label:'Home',     href:'/trustid/dashboard.html' },
    { id:'documents', icon:'📁', label:'Docs',     href:'/trustid/documents.html' },
    { id:'chat',      icon:'💬', label:'Messages', href:'/trustid/chat.html' },
    { id:'vault',     icon:'🔐', label:'Vault',    href:'/trustid/vault.html' },
    { id:'profile',   icon:'👤', label:'Profile',  href:'/trustid/profile.html' },
  ];

  var TITLES = {
    dashboard:'Dashboard', identity:'My Identity', documents:'Documents',
    academics:'Academics & Awards', lifestory:'Life Story', expenses:'Expenses',
    reminders:'Reminders', todo:'To-Do List', calendar:'Calendar',
    address:'My Address', vault:'Secret Vault', album:'Secret Album',
    legacy:'Digital Legacy', chat:'Messages', share:'Share My Vault',
    profile:'Profile', settings:'Settings',
    'admin-dashboard':'Platform Overview', 'admin-users':'User Management',
    'admin-docs':'Verification Queue', 'admin-trustids':'ID Registry', 'admin-features':'Feature Control',
  };

  /* Collapse state persisted in localStorage */
  function isCollapsed(groupId) {
    var stored = localStorage.getItem('pv_grp_' + groupId);
    /* Default: identity & life open, others collapsed */
    if (stored === null) return (groupId !== 'identity' && groupId !== 'life');
    return stored === '1';
  }
  function setCollapsed(groupId, val) {
    localStorage.setItem('pv_grp_' + groupId, val ? '1' : '0');
  }

  function navItem(item, active) {
    var sel = item.id === active;
    return '<a href="' + item.href + '" class="nav-item' + (sel ? ' active' : '') + '" title="' + item.label + '">'
      + '<span class="nav-icon">' + item.icon + '</span>'
      + '<span class="nav-label">' + item.label + '</span>'
      + (sel ? '<span class="nav-dot"></span>' : '')
      + '</a>';
  }

  function groupSection(group, activePage) {
    var collapsed = isCollapsed(group.id);
    var hasActive = group.items.some(function(i) { return i.id === activePage; });
    /* Auto-expand if active page is inside this group */
    if (hasActive) { collapsed = false; }

    return '<div class="nav-group" id="grp-' + group.id + '">'
      + '<button class="nav-group-hdr" onclick="Layout._toggleGroup(\'' + group.id + '\')" title="' + (collapsed ? 'Expand' : 'Collapse') + ' ' + group.label + '">'
      +   '<span class="nav-group-label">' + group.label + '</span>'
      +   '<span class="nav-group-arrow' + (collapsed ? '' : ' open') + '">›</span>'
      + '</button>'
      + '<div class="nav-group-items" id="grp-items-' + group.id + '" style="' + (collapsed ? 'display:none' : '') + '">'
      +   group.items.map(function(i) { return navItem(i, activePage); }).join('')
      + '</div>'
      + '</div>';
  }

  /* ══ INIT ══ */
  function init(activePage) {
    var user    = Auth.getUser() || {};
    var isAdmin = user.role === 'admin';
    var ini     = ((user.firstName || '')[0] || '').toUpperCase() + ((user.lastName || '')[0] || '').toUpperCase();
    var groups  = isAdmin ? ADMIN_GROUPS : GROUPS;

    /* ── Sidebar ── */
    var sb = document.getElementById('sidebar');
    if (sb) {
      sb.innerHTML =
        '<div class="sb-header">'
        +  '<div class="sb-logo-wrap">'
        +    '<div class="sb-logo-icon">🔐</div>'
        +    '<div class="sb-logo-text">'
        +      '<div class="sb-app-name">Personal Vault</div>'
        +      '<div class="sb-app-sub">' + (isAdmin ? 'ADMIN PORTAL' : 'YOUR PRIVATE SPACE') + '</div>'
        +    '</div>'
        +  '</div>'
        +  '<button class="sb-toggle-btn" id="sidebarToggle" onclick="Layout.toggle()" title="Collapse sidebar">◀</button>'
        + '</div>'

        + '<div class="sb-nav" id="sbNav">'
        +   groups.map(function(g) { return groupSection(g, activePage); }).join('')
        +   '<div class="sb-divider"></div>'
        +   '<div class="sb-section-label">ACCOUNT</div>'
        +   BOT_NAV.map(function(i) { return navItem(i, activePage); }).join('')
        + '</div>'

        + '<div class="sb-user">'
        +   '<div class="sb-avatar">' + ini + '</div>'
        +   '<div class="sb-user-info">'
        +     '<div class="sb-user-name">' + (user.firstName || '') + ' ' + (user.lastName || '') + '</div>'
        +     '<div class="sb-user-role">' + (isAdmin ? 'Administrator' : 'Vault Member') + '</div>'
        +   '</div>'
        +   '<button onclick="Auth.logout()" title="Sign out" class="sb-logout">↩</button>'
        + '</div>';

      /* Restore collapsed state */
      if (localStorage.getItem('pv_sidebar_hidden') === 'true') {
        sb.classList.add('sb-collapsed');
        var main = document.getElementById('main');
        if (main) main.classList.add('sb-hidden');
        var btn = document.getElementById('sidebarToggle');
        if (btn) btn.textContent = '▶';
      }
    }

    /* ── Topbar ── */
    var tb = document.getElementById('topbar');
    if (tb) {
      tb.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px">'
        +  '<button class="mobile-menu-btn" onclick="Layout.toggle()" title="Menu" id="mobileMenuBtn">☰</button>'
        +  '<span class="topbar-title">' + (TITLES[activePage] || 'Personal Vault') + '</span>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:10px">'
        +  '<div style="position:relative">'
        +    '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;color:#94A3B8">🔍</span>'
        +    '<input placeholder="Search…" class="topbar-search">'
        +  '</div>'
        +  '<div class="topbar-avatar">' + ini + '</div>'
        + '</div>';
    }

    /* ── Mobile bottom nav ── */
    if (!document.getElementById('bottomNav')) {
      var bn = document.createElement('nav');
      bn.id = 'bottomNav';
      bn.className = 'bottom-nav';
      bn.innerHTML = BOTTOM_NAV.map(function(item) {
        var sel = item.id === activePage;
        return '<a href="' + item.href + '" class="bn-item' + (sel ? ' active' : '') + '">'
          + '<span class="bn-icon">' + item.icon + '</span>'
          + '<span class="bn-label">' + item.label + '</span>'
          + '</a>';
      }).join('');
      document.body.appendChild(bn);
    }
  }

  /* ══ GROUP TOGGLE ══ */
  function _toggleGroup(id) {
    var items = document.getElementById('grp-items-' + id);
    var arrow = document.querySelector('#grp-' + id + ' .nav-group-arrow');
    if (!items) return;
    var nowHidden = items.style.display === 'none';
    items.style.display = nowHidden ? 'block' : 'none';
    if (arrow) arrow.classList.toggle('open', nowHidden);
    setCollapsed(id, !nowHidden);
  }

  /* ══ SIDEBAR TOGGLE ══ */
  function toggle() {
    var sb   = document.getElementById('sidebar');
    var main = document.getElementById('main');
    var btn  = document.getElementById('sidebarToggle');
    if (!sb) return;
    var isMobile = window.innerWidth <= 900;
    if (isMobile) {
      var isOpen = sb.classList.toggle('mobile-open');
      var overlay = document.getElementById('sb-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sb-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:49;display:none;backdrop-filter:blur(2px)';
        overlay.addEventListener('click', function() { toggle(); });
        document.body.appendChild(overlay);
      }
      overlay.style.display = isOpen ? 'block' : 'none';
      /* Prevent body scroll when sidebar open */
      document.body.style.overflow = isOpen ? 'hidden' : '';
    } else {
      var hidden = sb.classList.toggle('sb-collapsed');
      if (main) main.classList.toggle('sb-hidden', hidden);
      if (btn)  btn.textContent = hidden ? '▶' : '◀';
      localStorage.setItem('pv_sidebar_hidden', hidden);
    }
  }

  /* ══ UTILITIES ══ */
  function fmtDate(d)  { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'; }
  function fmtShort(d) { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'; }

  function badge(status) {
    var cls = { verified:'badge-verified',pending:'badge-pending',rejected:'badge-rejected',active:'badge-active',suspended:'badge-suspended' };
    var lbl = { verified:'Verified',pending:'Pending',rejected:'Rejected',active:'Active',suspended:'Suspended' };
    return '<span class="badge ' + (cls[status] || '') + '">' + (lbl[status] || status) + '</span>';
  }
  function tlN(l)     { return ['','Basic','Standard','Enhanced','High','Sovereign'][l] || 'Unknown'; }
  function tlColor(l) { return ['','#EF4444','#F97316','#EAB308','#22C55E','#7C3AED'][l] || '#94A3B8'; }

  function statCard(icon, label, value, color) {
    return '<div class="stat-card">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
      + '<div style="width:44px;height:44px;border-radius:12px;background:' + color + '18;display:flex;align-items:center;justify-content:center;font-size:22px">' + icon + '</div>'
      + '</div><div class="stat-value">' + value + '</div><div class="stat-label">' + label + '</div></div>';
  }

  function spinner() {
    return '<div style="display:flex;justify-content:center;padding:60px">'
      + '<div class="spinner" style="width:36px;height:36px;border-color:#7C3AED25;border-top-color:#7C3AED"></div></div>';
  }

  function toast(msg, type) {
    type = type || 'success';
    var icons  = { success:'✅',error:'❌',warning:'⚠️',info:'ℹ️' };
    var colors = { success:'#22C55E',error:'#EF4444',warning:'#F97316',info:'#3B82F6' };
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.style.cssText = 'border-left-color:' + colors[type];
    el.innerHTML = '<span style="font-size:16px">' + icons[type] + '</span>'
      + '<span style="flex:1;font-size:13px;font-weight:600;color:#0F172A">' + msg + '</span>'
      + '<button onclick="this.parentNode.remove()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#94A3B8">×</button>';
    var wrap = document.getElementById('toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.id='toast-wrap'; wrap.className='toast-wrap'; document.body.appendChild(wrap); }
    wrap.appendChild(el);
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 5000);
  }

  function qrImg(text, size) {
    size = size || 200;
    return '<img src="https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(text) + '" alt="QR Code" style="border-radius:12px;width:' + size + 'px;height:' + size + 'px">';
  }

  /* ── Auto-logout after 5 minutes of inactivity ── */
  function startInactivityTimer() {
    var TIMEOUT_MS = 5 * 60 * 1000;
    var WARN_MS    = 4 * 60 * 1000;
    var logoutTimer = null, warnTimer = null, warnEl = null, countdown = null, secsLeft = 60;

    function createWarning() {
      if (warnEl) return;
      warnEl = document.createElement('div');
      warnEl.id = 'inactivity-warn';
      warnEl.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;background:#1E1B4B;color:#fff;border-radius:16px;padding:16px 20px;box-shadow:0 8px 32px rgba(0,0,0,0.3);display:flex;align-items:center;gap:12px;min-width:300px;border:1px solid rgba(255,255,255,0.12);animation:slideUp 0.3s ease';
      warnEl.innerHTML = '<span style="font-size:22px">⏱️</span>'
        + '<div style="flex:1"><div style="font-weight:700;font-size:13px;margin-bottom:2px">Session expiring soon</div>'
        + '<div style="font-size:12px;opacity:0.7">Logout in <strong id="iact-secs">60</strong>s due to inactivity</div></div>'
        + '<button onclick="Layout.resetInactivity()" style="background:linear-gradient(135deg,#7C3AED,#8B5CF6);border:none;color:#fff;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">Stay logged in</button>';
      document.body.appendChild(warnEl);
      secsLeft = 60;
      countdown = setInterval(function() {
        secsLeft--;
        var el = document.getElementById('iact-secs');
        if (el) el.textContent = secsLeft;
        if (secsLeft <= 0) clearInterval(countdown);
      }, 1000);
    }

    function removeWarning() {
      if (warnEl) { warnEl.remove(); warnEl = null; }
      if (countdown) { clearInterval(countdown); countdown = null; }
      secsLeft = 60;
    }

    function scheduleLogout() {
      clearTimeout(logoutTimer); clearTimeout(warnTimer); removeWarning();
      warnTimer   = setTimeout(createWarning, WARN_MS);
      logoutTimer = setTimeout(function() {
        removeWarning();
        sessionStorage.setItem('pv_return', window.location.pathname + window.location.search);
        Auth.logout();
      }, TIMEOUT_MS);
    }

    function reset() { scheduleLogout(); }

    var throttled = false;
    ['mousemove','mousedown','keydown','touchstart','scroll','click'].forEach(function(ev) {
      document.addEventListener(ev, function() {
        if (throttled) return;
        throttled = true;
        setTimeout(function() { throttled = false; }, 10000);
        scheduleLogout();
      }, { passive: true });
    });

    scheduleLogout();
    return { reset: reset };
  }

  var _inactivity = null;

  return {
    init,
    toggle,
    _toggleGroup,
    fmtDate, fmtShort,
    badge, tlN, tlColor,
    statCard, spinner, toast, qrImg,
    resetInactivity: function() { if (_inactivity) _inactivity.reset(); },
    _startInactivity: function() { _inactivity = startInactivityTimer(); },
  };
})();

/* Start inactivity timer on authenticated pages */
(function() {
  try {
    if (localStorage.getItem('tid_token')) {
      setTimeout(function() { Layout._startInactivity(); }, 500);
    }
  } catch(e) {}
})();
