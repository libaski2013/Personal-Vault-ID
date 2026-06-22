/* ── Personal Vault — Shared Layout ── */
var Layout = (function () {

  var USER_NAV = [
    { id:'dashboard',  icon:'🏠', label:'Dashboard',        href:'/trustid/dashboard.html' },
    { id:'identity',   icon:'🛡️', label:'My Identity',       href:'/trustid/certificate.html' },
    { id:'documents',  icon:'📁', label:'Documents',         href:'/trustid/documents.html' },
    { id:'academics',  icon:'🎓', label:'Academics',         href:'/trustid/academics.html' },
    { id:'lifestory',  icon:'📖', label:'Life Story',        href:'/trustid/lifestory.html' },
    { id:'expenses',   icon:'💰', label:'Expenses',          href:'/trustid/expenses.html' },
    { id:'reminders',  icon:'🔔', label:'Reminders',         href:'/trustid/reminders.html' },
    { id:'todo',       icon:'✅', label:'To-Do',             href:'/trustid/todo.html' },
    { id:'calendar',   icon:'📅', label:'Calendar',          href:'/trustid/calendar.html' },
    { id:'address',    icon:'🏠', label:'My Address',        href:'/trustid/address.html' },
    { id:'vault',      icon:'🔐', label:'Secret Vault',      href:'/trustid/vault.html' },
    { id:'legacy',     icon:'⏳', label:'Digital Legacy',     href:'/trustid/legacy.html' },
    { id:'social',     icon:'🛰️', label:'Social Network',     href:'/trustid/social.html' },
    { id:'chat',       icon:'💬', label:'Messages',            href:'/trustid/chat.html' },
    { id:'share',      icon:'📤', label:'Share My Vault',      href:'/trustid/share.html' },
  ];
  var BOT_NAV = [
    { id:'profile',  icon:'👤', label:'Profile',  href:'/trustid/profile.html' },
    { id:'settings', icon:'⚙️', label:'Settings', href:'/trustid/settings.html' },
  ];
  var ADMIN_NAV = [
    { id:'admin-dashboard', icon:'📊', label:'Overview',           href:'/trustid/admin/dashboard.html' },
    { id:'admin-users',     icon:'👥', label:'Users',              href:'/trustid/admin/users.html' },
    { id:'admin-docs',      icon:'📋', label:'Verification Queue', href:'/trustid/admin/docs.html' },
    { id:'admin-trustids',  icon:'🛡️', label:'ID Registry',       href:'/trustid/admin/trustids.html' },
  ];
  var TITLES = {
    dashboard:'Dashboard', identity:'My Identity', documents:'Documents',
    academics:'Academics & Awards', lifestory:'Life Story', expenses:'Expenses',
    reminders:'Reminders', todo:'To-Do List', calendar:'Calendar',
    address:'My Address', vault:'Secret Vault', legacy:'Digital Legacy', social:'Social Network', chat:'Messages', share:'Share My Vault',
    profile:'Profile', settings:'Settings',
    'admin-dashboard':'Platform Overview', 'admin-users':'User Management',
    'admin-docs':'Verification Queue', 'admin-trustids':'ID Registry',
  };

  function navItem(item, active) {
    var sel = item.id === active;
    return '<a href="'+item.href+'" class="nav-item'+(sel?' active':'')+'" title="'+item.label+'">'
      + '<span class="nav-icon">'+item.icon+'</span>'
      + '<span class="nav-label">'+item.label+'</span>'
      + (sel ? '<span class="nav-dot"></span>' : '')
      + '</a>';
  }

  function init(activePage) {
    var user    = Auth.getUser() || {};
    var isAdmin = user.role === 'admin';
    var ini     = ((user.firstName||'')[0]||'').toUpperCase() + ((user.lastName||'')[0]||'').toUpperCase();
    var items   = isAdmin ? ADMIN_NAV : USER_NAV;

    /* ── Sidebar ── */
    var sb = document.getElementById('sidebar');
    if (sb) {
      sb.innerHTML =
        '<div class="sb-header">'
        + '<div class="sb-logo-wrap">'
        +   '<div class="sb-logo-icon">🔐</div>'
        +   '<div class="sb-logo-text"><div class="sb-app-name">Personal Vault</div>'
        +   '<div class="sb-app-sub">'+(isAdmin?'ADMIN PORTAL':'YOUR PRIVATE SPACE')+'</div></div>'
        + '</div>'
        + '<button class="sb-toggle-btn" id="sidebarToggle" title="Hide sidebar" onclick="Layout.toggle()">◀</button>'
        + '</div>'
        + '<div class="sb-nav" id="sbNav">'
        + (isAdmin ? '' : '<div class="sb-section-label">MAIN</div>')
        + items.slice(0, isAdmin ? 99 : 5).map(function(i){ return navItem(i, activePage); }).join('')
        + (!isAdmin ? '<div class="sb-section-label" style="margin-top:8px">MY LIFE</div>'
          + items.slice(5).map(function(i){ return navItem(i, activePage); }).join('') : '')
        + '<div class="sb-divider"></div>'
        + '<div class="sb-section-label">ACCOUNT</div>'
        + BOT_NAV.map(function(i){ return navItem(i, activePage); }).join('')
        + '</div>'
        + '<div class="sb-user">'
        +   '<div class="sb-avatar">'+ini+'</div>'
        +   '<div class="sb-user-info">'
        +     '<div class="sb-user-name">'+(user.firstName||'')+' '+(user.lastName||'')+'</div>'
        +     '<div class="sb-user-role">'+(isAdmin?'Administrator':'Vault Member')+'</div>'
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
        '<div style="display:flex;align-items:center;gap:12px">'
        + '<button onclick="Layout.toggle()" title="Toggle menu" style="background:none;border:none;cursor:pointer;font-size:22px;color:#334155;padding:4px 6px;border-radius:8px;display:flex;align-items:center;justify-content:center" id="mobileMenuBtn">☰</button>'
        + '<span class="topbar-title">'+(TITLES[activePage]||'Personal Vault')+'</span>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:12px">'
        +   '<div style="position:relative">'
        +     '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px">🔍</span>'
        +     '<input placeholder="Search…" class="topbar-search">'
        +   '</div>'
        +   '<div class="topbar-avatar">'+ini+'</div>'
        + '</div>';
    }
  }

  function toggle() {
    var sb   = document.getElementById('sidebar');
    var main = document.getElementById('main');
    var btn  = document.getElementById('sidebarToggle');
    if (!sb) return;

    var isMobile = window.innerWidth <= 900;

    if (isMobile) {
      /* On mobile: slide in/out as an overlay */
      var isOpen = sb.classList.toggle('mobile-open');
      /* Dim the background when open */
      var overlay = document.getElementById('sb-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sb-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:49;display:none';
        overlay.addEventListener('click', function(){ toggle(); });
        document.body.appendChild(overlay);
      }
      overlay.style.display = isOpen ? 'block' : 'none';
    } else {
      /* On desktop: collapse to icon rail */
      var hidden = sb.classList.toggle('sb-collapsed');
      if (main) main.classList.toggle('sb-hidden', hidden);
      if (btn)  btn.textContent = hidden ? '▶' : '◀';
      localStorage.setItem('pv_sidebar_hidden', hidden);
    }
  }

  /* ── Utilities used by page scripts ── */
  function fmtDate(d)  { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'; }
  function fmtShort(d) { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'; }

  function badge(status) {
    var cls = { verified:'badge-verified', pending:'badge-pending', rejected:'badge-rejected', active:'badge-active', suspended:'badge-suspended' };
    var lbl = { verified:'Verified', pending:'Pending', rejected:'Rejected', active:'Active', suspended:'Suspended' };
    return '<span class="badge '+(cls[status]||'')+'">'+( lbl[status]||status)+'</span>';
  }
  function tlN(l)     { return ['','Basic','Standard','Enhanced','High','Sovereign'][l]||'Unknown'; }
  function tlColor(l) { return ['','#EF4444','#F97316','#EAB308','#22C55E','#7C3AED'][l]||'#94A3B8'; }

  function statCard(icon, label, value, color) {
    return '<div class="stat-card">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
      +'<div style="width:44px;height:44px;border-radius:12px;background:'+color+'18;display:flex;align-items:center;justify-content:center;font-size:22px">'+icon+'</div>'
      +'</div><div class="stat-value">'+value+'</div><div class="stat-label">'+label+'</div></div>';
  }

  function spinner() {
    return '<div style="display:flex;justify-content:center;padding:60px">'
      +'<div class="spinner" style="width:36px;height:36px;border-color:#7C3AED25;border-top-color:#7C3AED"></div></div>';
  }

  function toast(msg, type) {
    type = type||'success';
    var icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    var colors = { success:'#22C55E', error:'#EF4444', warning:'#F97316', info:'#3B82F6' };
    var el = document.createElement('div');
    el.className = 'toast toast-'+type;
    el.style.cssText = 'border-left-color:'+colors[type];
    el.innerHTML = '<span style="font-size:16px">'+icons[type]+'</span>'
      +'<span style="flex:1;font-size:13px;font-weight:600;color:#0F172A">'+msg+'</span>'
      +'<button onclick="this.parentNode.remove()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#94A3B8">×</button>';
    var wrap = document.getElementById('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    wrap.appendChild(el);
    setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 5000);
  }

  function qrImg(text, size) {
    size = size || 200;
    return '<img src="https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+'&data='+encodeURIComponent(text)+'" alt="QR Code" style="border-radius:12px;width:'+size+'px;height:'+size+'px">';
  }

  return { init, toggle, fmtDate, fmtShort, badge, tlN, tlColor, statCard, spinner, toast, qrImg };
})();
