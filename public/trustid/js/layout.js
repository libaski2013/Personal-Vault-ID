/* ── TrustID Shared Layout (sidebar + topbar) ── */
var Layout = (function () {

  var USER_NAV = [
    { id:'dashboard',  icon:'🏠', label:'Dashboard',      href:'/trustid/dashboard.html' },
    { id:'trustid',    icon:'🛡️', label:'My TrustID',     href:'/trustid/certificate.html' },
    { id:'documents',  icon:'📁', label:'Documents',       href:'/trustid/documents.html' },
    { id:'expenses',   icon:'💰', label:'Expenses',        href:'/trustid/expenses.html' },
    { id:'reminders',  icon:'🔔', label:'Reminders',       href:'/trustid/reminders.html' },
    { id:'todo',       icon:'✅', label:'To-Do List',      href:'/trustid/todo.html' },
    { id:'calendar',   icon:'📅', label:'Calendar',        href:'/trustid/calendar.html' },
  ];
  var BOT_NAV = [
    { id:'profile',  icon:'👤', label:'Profile',  href:'/trustid/profile.html' },
    { id:'settings', icon:'⚙️', label:'Settings', href:'/trustid/settings.html' },
  ];
  var ADMIN_NAV = [
    { id:'admin-dashboard', icon:'📊', label:'Overview',           href:'/trustid/admin/dashboard.html' },
    { id:'admin-users',     icon:'👥', label:'Users',              href:'/trustid/admin/users.html' },
    { id:'admin-docs',      icon:'📋', label:'Verification Queue', href:'/trustid/admin/docs.html' },
    { id:'admin-trustids',  icon:'🛡️', label:'TrustID Registry',  href:'/trustid/admin/trustids.html' },
  ];
  var TITLES = {
    dashboard:'Dashboard', trustid:'My TrustID', documents:'Documents', expenses:'Expenses',
    reminders:'Reminders', todo:'To-Do List', calendar:'Calendar', profile:'Profile',
    settings:'Settings', 'admin-dashboard':'Platform Overview', 'admin-users':'User Management',
    'admin-docs':'Verification Queue', 'admin-trustids':'TrustID Registry',
  };

  function navItem(item, active) {
    var sel = item.id === active;
    return '<a href="'+item.href+'" class="nav-item'+(sel?' active':'')+'">'
      + '<span class="nav-icon">'+item.icon+'</span>'
      + '<span>'+item.label+'</span>'
      + (sel ? '<span class="nav-dot"></span>' : '')
      + '</a>';
  }

  function init(activePage) {
    var user    = Auth.getUser() || {};
    var isAdmin = user.role === 'admin';
    var ini     = ((user.firstName||'')[0]||'').toUpperCase() + ((user.lastName||'')[0]||'').toUpperCase();
    var items   = isAdmin ? ADMIN_NAV : USER_NAV;

    /* Sidebar */
    var sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) {
      sidebarEl.innerHTML =
        '<div class="sidebar-logo">'
        +  '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#7C3AED,#8B5CF6);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🛡️</div>'
        +  '<div><div style="color:#fff;font-weight:900;font-size:17px">TrustID</div>'
        +  '<div style="color:rgba(255,255,255,0.35);font-size:9px;font-weight:700;letter-spacing:1.2px">'+(isAdmin?'ADMIN PORTAL':'PLATFORM')+'</div></div>'
        +'</div>'
        +'<div class="sidebar-nav">'
        + items.map(function(i){ return navItem(i, activePage); }).join('')
        + '<div class="sidebar-divider"></div>'
        + '<div class="sidebar-section-label">ACCOUNT</div>'
        + BOT_NAV.map(function(i){ return navItem(i, activePage); }).join('')
        +'</div>'
        +'<div class="sidebar-user">'
        +  '<div class="sidebar-avatar">'+ini+'</div>'
        +  '<div style="flex:1;overflow:hidden">'
        +    '<div style="color:#fff;font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(user.firstName||'')+' '+(user.lastName||'')+'</div>'
        +    '<div style="color:rgba(255,255,255,0.38);font-size:10px">'+(isAdmin?'Administrator':'User')+'</div>'
        +  '</div>'
        +  '<button onclick="Auth.logout()" title="Sign out" style="background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.4);font-size:17px;padding:4px">↩</button>'
        +'</div>';
    }

    /* Topbar */
    var topbarEl = document.getElementById('topbar');
    if (topbarEl) {
      topbarEl.innerHTML =
        '<span style="font-size:18px;font-weight:900;color:#0F172A">'+(TITLES[activePage]||'TrustID')+'</span>'
        +'<div style="display:flex;align-items:center;gap:14px">'
        +  '<div style="position:relative">'
        +    '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:14px">🔍</span>'
        +    '<input placeholder="Search…" style="width:210px;height:37px;padding:0 12px 0 32px;border-radius:10px;border:1px solid #E2E8F0;background:#F8FAFC;font-size:13px;outline:none">'
        +  '</div>'
        +  '<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#8B5CF6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">'+ini+'</div>'
        +'</div>';
    }

    /* Mobile menu button */
    var menuBtn = document.getElementById('menuBtn');
    if (menuBtn) {
      menuBtn.addEventListener('click', function () {
        var sb = document.getElementById('sidebar');
        if (sb) sb.classList.toggle('open');
      });
    }
  }

  /* ── Helpers for page scripts ── */
  function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
  }
  function fmtShort(d) {
    return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—';
  }
  function badge(status) {
    var map = { verified:'badge-verified', pending:'badge-pending', rejected:'badge-rejected', active:'badge-active', suspended:'badge-suspended' };
    var labels = { verified:'Verified', pending:'Pending', rejected:'Rejected', active:'Active', suspended:'Suspended' };
    return '<span class="badge '+(map[status]||'')+'">'+( labels[status]||status)+'</span>';
  }
  function tlN(l) { return ['','Basic','Standard','Enhanced','High','Sovereign'][l]||'Unknown'; }
  function tlColor(l) { return ['','#EF4444','#F97316','#EAB308','#22C55E','#7C3AED'][l]||'#94A3B8'; }
  function statCard(icon, label, value, color) {
    return '<div class="stat-card">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
      + '<div style="width:44px;height:44px;border-radius:12px;background:'+color+'15;display:flex;align-items:center;justify-content:center;font-size:22px">'+icon+'</div>'
      + '</div>'
      + '<div class="stat-value">'+value+'</div>'
      + '<div class="stat-label">'+label+'</div>'
      + '</div>';
  }
  function spinner() {
    return '<div style="display:flex;justify-content:center;padding:60px"><div class="spinner" style="width:32px;height:32px;border-color:#7C3AED30;border-top-color:#7C3AED"></div></div>';
  }
  function toast(msg, type) {
    type = type || 'success';
    var icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    var colors = { success:'#22C55E', error:'#EF4444', warning:'#F97316', info:'#3B82F6' };
    var el = document.createElement('div');
    el.className = 'toast toast-'+type;
    el.style.borderLeftColor = colors[type]||'#3B82F6';
    el.innerHTML = '<span>'+icons[type]+'</span><span style="flex:1;font-size:13px;font-weight:600">'+msg+'</span>';
    var wrap = document.getElementById('toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.id='toast-wrap'; wrap.className='toast-wrap'; document.body.appendChild(wrap); }
    wrap.appendChild(el);
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 4000);
  }

  return { init: init, fmtDate: fmtDate, fmtShort: fmtShort, badge: badge, tlN: tlN, tlColor: tlColor, statCard: statCard, spinner: spinner, toast: toast };
})();
