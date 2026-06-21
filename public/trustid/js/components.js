/* ── TrustID Shared React Components ── */
/* All top-level declarations use var so they are visible to other <script> tags */

var _R  = React;
var h   = React.createElement;
var useState     = React.useState;
var useEffect    = React.useEffect;
var useCallback  = React.useCallback;
var useContext   = React.useContext;
var createContext = React.createContext;
var useRef       = React.useRef;

/* ── Colors ── */
var C = {
  purple:'#7C3AED', purpleL:'#8B5CF6', navy:'#1E1B4B', navyD:'#0F0E2A',
  blue:'#3B82F6', green:'#22C55E', orange:'#F97316', red:'#EF4444',
  yellow:'#EAB308', pink:'#EC4899',
  50:'#F8FAFC', 100:'#F1F5F9', 200:'#E2E8F0', 300:'#CBD5E1',
  400:'#94A3B8', 500:'#64748B', 600:'#475569', 700:'#334155',
  800:'#1E293B', 900:'#0F172A',
};

/* ── Helpers ── */
var tlC = function (l) { return ([null,C.red,C.orange,C.yellow,C.green,C.purple][l] || C[400]); };
var tlN = function (l) { return ([null,'Basic','Standard','Enhanced','High','Sovereign'][l] || 'Unknown'); };
var fmtDate  = function (d) { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'; };
var fmtShort = function (d) { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'; };

/* ── Navigation ── */
var ROUTES = {
  dashboard:'dashboard.html', trustid:'certificate.html', documents:'documents.html',
  expenses:'expenses.html', reminders:'reminders.html', todo:'todo.html',
  calendar:'calendar.html', profile:'profile.html', settings:'settings.html',
  'admin-dashboard':'admin/dashboard.html', 'admin-users':'admin/users.html',
  'admin-docs':'admin/docs.html', 'admin-trustids':'admin/trustids.html',
};
var PAGE_TITLES = {
  dashboard:'Dashboard', trustid:'My TrustID', documents:'Documents', expenses:'Expenses',
  reminders:'Reminders', todo:'To-Do List', calendar:'Calendar', profile:'Profile',
  settings:'Settings', 'admin-dashboard':'Platform Overview', 'admin-users':'User Management',
  'admin-docs':'Verification Queue', 'admin-trustids':'TrustID Registry',
};

/* ── Toast context ── */
var ToastCtx = createContext(function () {});
var useToast = function () { return useContext(ToastCtx); };

/* ── useToastState ── */
function useToastState() {
  var pair = useState([]);
  var toasts = pair[0], setToasts = pair[1];
  var add = useCallback(function (t) {
    var id = Date.now() + Math.random();
    setToasts(function (p) { return p.concat([Object.assign({ id: id }, t)]); });
    setTimeout(function () { setToasts(function (p) { return p.filter(function (x) { return x.id !== id; }); }); }, 4000);
  }, []);
  var remove = useCallback(function (id) {
    setToasts(function (p) { return p.filter(function (x) { return x.id !== id; }); });
  }, []);
  return { toasts: toasts, add: add, remove: remove };
}

/* ── Toasts ── */
function Toasts(props) {
  var icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  return h('div', { className:'toast-wrap' },
    props.toasts.map(function (t) {
      return h('div', { key:t.id, className:'toast toast-'+t.type },
        h('span', null, icons[t.type] || 'ℹ️'),
        h('div', { style:{flex:1} },
          h('div', { style:{fontWeight:700,fontSize:13} }, t.msg),
          t.body && h('div', { style:{fontSize:12,color:C[500],marginTop:2} }, t.body)
        ),
        h('button', { onClick:function(){props.remove(t.id);}, style:{background:'none',border:'none',cursor:'pointer',fontSize:18,color:C[400]} }, '×')
      );
    })
  );
}

/* ── Spin ── */
function Spin(props) {
  var sz  = props.sz  || 20;
  var clr = props.clr || C.purple;
  return h('div', { className:'spinner', style:{width:sz,height:sz,borderColor:clr+'30',borderTopColor:clr} });
}

/* ── Badge ── */
function Badge(props) {
  var map = { verified:'badge-verified', pending:'badge-pending', rejected:'badge-rejected', active:'badge-active', suspended:'badge-suspended' };
  var labels = { verified:'Verified', pending:'Pending', rejected:'Rejected', active:'Active', suspended:'Suspended' };
  return h('span', { className:'badge '+(map[props.status]||'') }, labels[props.status]||props.status);
}

/* ── TBadge ── */
function TBadge(props) {
  var c = tlC(props.level);
  return h('span', { style:{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 11px',borderRadius:100,background:c+'18',border:'1px solid '+c+'40',color:c,fontSize:11,fontWeight:700} },
    '🛡 L'+props.level+' · '+tlN(props.level)
  );
}

/* ── ScoreRing ── */
function ScoreRing(props) {
  var score = props.score || 0;
  var size  = props.size  || 100;
  var r = size/2-10, circ = 2*Math.PI*r;
  var c = tlC(score>=800?5:score>=600?4:score>=400?3:score>=200?2:1);
  return h('div', { style:{position:'relative',width:size,height:size,flexShrink:0} },
    h('svg', { width:size, height:size, style:{transform:'rotate(-90deg)'} },
      h('circle', { cx:size/2, cy:size/2, r:r, fill:'none', stroke:C[200], strokeWidth:7 }),
      h('circle', { cx:size/2, cy:size/2, r:r, fill:'none', stroke:c, strokeWidth:7,
        strokeDasharray:circ, strokeDashoffset:circ*(1-score/1000), strokeLinecap:'round' })
    ),
    h('div', { style:{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'} },
      h('span', { style:{fontSize:size*0.2,fontWeight:900,color:c,lineHeight:1} }, score),
      h('span', { style:{fontSize:size*0.1,color:C[500],fontWeight:600} }, '/1000')
    )
  );
}

/* ── StatCard ── */
function StatCard(props) {
  var color = props.color || C.purple;
  return h('div', { className:'stat-card' },
    h('div', { style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14} },
      h('div', { style:{width:44,height:44,borderRadius:12,background:color+'15',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22} }, props.icon),
      props.delta !== undefined && h('span', { style:{fontSize:12,fontWeight:700,color:props.delta>=0?C.green:C.red} },
        (props.delta>=0?'↑':'↓')+' '+Math.abs(props.delta)+'%')
    ),
    h('div', { className:'stat-value' }, props.value),
    h('div', { className:'stat-label' }, props.label)
  );
}

/* ── Modal ── */
function Modal(props) {
  if (!props.open) return null;
  return h('div', { className:'modal-backdrop', onClick:props.onClose },
    h('div', { className:'modal', style:{maxWidth:props.width||500}, onClick:function(e){e.stopPropagation();} },
      h('div', { className:'modal-header' },
        h('span', { className:'modal-title' }, props.title),
        h('button', { onClick:props.onClose, style:{width:32,height:32,borderRadius:8,background:C[100],border:'none',cursor:'pointer',fontSize:18,color:C[600]} }, '×')
      ),
      props.children
    )
  );
}

/* ── Btn ── */
function Btn(props) {
  var v    = props.v    || 'primary';
  var sm   = props.sm   || false;
  var full = props.full !== false;
  var cls  = ['btn','btn-'+v, sm?'btn-sm':'', full?'btn-full':''].filter(Boolean).join(' ');
  return h('button', { className:cls, onClick:!props.loading&&!props.disabled?props.onClick:undefined, disabled:props.disabled||props.loading },
    props.loading
      ? h(Spin, { sz:14, clr:v==='outline'?C.purple:'#fff' })
      : props.icon && h('span', { style:{fontSize:sm?13:15} }, props.icon),
    props.label
  );
}

/* ── Field ── */
function Field(props) {
  var type  = props.type  || 'text';
  var icon  = props.icon;
  var error = props.error;
  return h('div', { className:'field' },
    props.label && h('label', { className:'label' },
      props.label,
      props.req && h('span', { style:{color:C.red,marginLeft:3} }, '*')
    ),
    h('div', { style:{position:'relative'} },
      icon && h('span', { style:{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:15,pointerEvents:'none'} }, icon),
      h('input', {
        type: type, value: props.value, placeholder: props.placeholder,
        onChange: function(e) { props.onChange && props.onChange(e.target.value); },
        onKeyDown: function(e) { props.onKey && props.onKey(e); },
        className: 'input'+(icon?' input-icon':''),
        style: error ? {borderColor:C.red} : {},
      })
    ),
    error && h('div', { style:{color:C.red,fontSize:11,marginTop:4} }, error)
  );
}

/* ── Sel ── */
function Sel(props) {
  return h('div', null,
    props.label && h('label', { className:'label' }, props.label),
    h('select', { value:props.value, onChange:function(e){props.onChange(e.target.value);}, className:'input' },
      props.ph && h('option', { value:'' }, props.ph),
      props.options.map(function(o) {
        var val = typeof o==='string'?o:o.v;
        var lbl = typeof o==='string'?o:o.l;
        return h('option', { key:val, value:val }, lbl);
      })
    )
  );
}

/* ── PageHeader ── */
function PH(props) {
  return h('div', { className:'page-header' },
    h('div', null,
      h('h1', { className:'page-title' }, props.title),
      props.sub && h('p', { className:'page-sub' }, props.sub)
    ),
    props.actions && h('div', { style:{display:'flex',gap:10} }, props.actions)
  );
}

/* ── Sidebar ── */
function Sidebar(props) {
  var user    = props.user    || {};
  var isAdmin = props.isAdmin || false;
  var active  = props.active;

  var userNav = [
    { id:'dashboard', ic:'🏠', lb:'Dashboard' },
    { id:'trustid',   ic:'🛡️', lb:'My TrustID' },
    { id:'documents', ic:'📁', lb:'Documents' },
    { id:'expenses',  ic:'💰', lb:'Expenses' },
    { id:'reminders', ic:'🔔', lb:'Reminders' },
    { id:'todo',      ic:'✅', lb:'To-Do List' },
    { id:'calendar',  ic:'📅', lb:'Calendar' },
  ];
  var adminNav = [
    { id:'admin-dashboard', ic:'📊', lb:'Overview' },
    { id:'admin-users',     ic:'👥', lb:'Users' },
    { id:'admin-docs',      ic:'📋', lb:'Verification Queue' },
    { id:'admin-trustids',  ic:'🛡️', lb:'TrustID Registry' },
  ];
  var botNav = [
    { id:'profile',  ic:'👤', lb:'Profile' },
    { id:'settings', ic:'⚙️', lb:'Settings' },
  ];
  var items = isAdmin ? adminNav : userNav;
  var ini = ((user.firstName||'')[0]||'') + ((user.lastName||'')[0]||'');

  function NavItem(np) {
    var sel = active === np.item.id;
    return h('button', {
      className: 'nav-item'+(sel?' active':''),
      onClick: function(){ props.onNav(np.item.id); },
    },
      h('span', { style:{fontSize:17,width:20,textAlign:'center',flexShrink:0} }, np.item.ic),
      h('span', { style:{flex:1} }, np.item.lb),
      sel && h('div', { style:{width:5,height:5,borderRadius:'50%',background:'rgba(255,255,255,0.7)'} })
    );
  }

  return h('div', { className:'sidebar' },
    h('div', { className:'sidebar-logo' },
      h('div', { style:{display:'flex',alignItems:'center',gap:10} },
        h('div', { style:{width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,'+C.purple+','+C.purpleL+')',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20} }, '🛡️'),
        h('div', null,
          h('div', { style:{color:'#fff',fontWeight:900,fontSize:17} }, 'TrustID'),
          h('div', { style:{color:'rgba(255,255,255,0.35)',fontSize:9,fontWeight:700,letterSpacing:1.2} }, isAdmin?'ADMIN PORTAL':'PLATFORM')
        )
      )
    ),
    h('div', { className:'sidebar-nav' },
      items.map(function(item){ return h(NavItem, { key:item.id, item:item }); }),
      h('div', { style:{height:1,background:'rgba(255,255,255,0.07)',margin:'10px 0'} }),
      h('div', { style:{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.28)',letterSpacing:1.2,padding:'0 13px',marginBottom:7} }, 'ACCOUNT'),
      botNav.map(function(item){ return h(NavItem, { key:item.id, item:item }); })
    ),
    h('div', { className:'sidebar-user' },
      h('div', { style:{width:38,height:38,borderRadius:'50%',background:'linear-gradient(135deg,'+C.purple+','+C.purpleL+')',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:13,flexShrink:0} }, ini||'U'),
      h('div', { style:{flex:1,overflow:'hidden'} },
        h('div', { style:{color:'#fff',fontWeight:600,fontSize:12,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'} }, (user.firstName||'')+' '+(user.lastName||'')),
        h('div', { style:{color:'rgba(255,255,255,0.38)',fontSize:10} }, user.role==='admin'?'Administrator':'User')
      ),
      h('button', { onClick:props.onLogout, title:'Sign out', style:{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)',fontSize:17,padding:4} }, '↩')
    )
  );
}

/* ── TopBar ── */
function TopBar(props) {
  var user = props.user || {};
  var ini  = ((user.firstName||'')[0]||'')+((user.lastName||'')[0]||'');
  return h('div', { className:'top-bar' },
    h('span', { style:{fontSize:18,fontWeight:900,color:C[900]} }, props.title),
    h('div', { style:{display:'flex',alignItems:'center',gap:14} },
      h('div', { style:{position:'relative'} },
        h('span', { style:{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:14} }, '🔍'),
        h('input', { placeholder:'Search…', className:'input input-icon', style:{width:210,height:37,background:C[50],border:'1px solid '+C[200]} })
      ),
      h('div', { style:{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,'+C.purple+','+C.purpleL+')',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:14} }, ini||'U')
    )
  );
}

/* ── AppLayout ── */
function AppLayout(props) {
  var user    = Auth.getUser() || {};
  var isAdmin = user.role === 'admin';
  var ts      = useToastState();

  function navigate(id) {
    var file = ROUTES[id];
    if (!file) return;
    /* Admin pages live one level deeper, so go up a directory first */
    var onAdminPage = window.location.pathname.indexOf('/admin/') !== -1;
    var base = onAdminPage ? '../' : './';
    window.location.href = base + file;
  }

  return h(ToastCtx.Provider, { value: ts.add },
    h(Toasts, { toasts:ts.toasts, remove:ts.remove }),
    h(Sidebar, { active:props.activePage, isAdmin:isAdmin, onNav:navigate, user:user, onLogout:Auth.logout }),
    h('div', { className:'main-wrap' },
      h(TopBar, { title:PAGE_TITLES[props.activePage]||'TrustID', user:user }),
      h('div', { className:'page-content' },
        typeof props.children === 'function' ? props.children(ts.add) : props.children
      )
    )
  );
}
