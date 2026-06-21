/* ── TrustID Shared React Components ── */
/* Requires React 18 CDN loaded before this file */

const { useState, useEffect, useCallback, useContext, createContext, createElement: h } = React;

/* ── Colors ── */
const C = {
  purple:'#7C3AED', purpleL:'#8B5CF6', navy:'#1E1B4B', navyD:'#0F0E2A',
  blue:'#3B82F6', green:'#22C55E', orange:'#F97316', red:'#EF4444',
  yellow:'#EAB308', pink:'#EC4899',
  50:'#F8FAFC', 100:'#F1F5F9', 200:'#E2E8F0', 300:'#CBD5E1',
  400:'#94A3B8', 500:'#64748B', 600:'#475569', 700:'#334155',
  800:'#1E293B', 900:'#0F172A',
};

/* ── Helpers ── */
const tlC = l => [null,C.red,C.orange,C.yellow,C.green,C.purple][l] || C[400];
const tlN = l => [null,'Basic','Standard','Enhanced','High','Sovereign'][l] || 'Unknown';
const fmtDate  = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
const fmtShort = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—';

/* ── Navigation routes ── */
const ROUTES = {
  dashboard:'dashboard.html', trustid:'certificate.html', documents:'documents.html',
  expenses:'expenses.html', reminders:'reminders.html', todo:'todo.html',
  calendar:'calendar.html', profile:'profile.html', settings:'settings.html',
  'admin-dashboard':'admin/dashboard.html', 'admin-users':'admin/users.html',
  'admin-docs':'admin/docs.html', 'admin-trustids':'admin/trustids.html',
};
const PAGE_TITLES = {
  dashboard:'Dashboard', trustid:'My TrustID', documents:'Documents', expenses:'Expenses',
  reminders:'Reminders', todo:'To-Do List', calendar:'Calendar', profile:'Profile',
  settings:'Settings', 'admin-dashboard':'Platform Overview', 'admin-users':'User Management',
  'admin-docs':'Verification Queue', 'admin-trustids':'TrustID Registry',
};

/* ── Toast context ── */
const ToastCtx = createContext(() => {});
const useToast  = () => useContext(ToastCtx);

/* ── Toasts container ── */
function Toasts({ toasts, remove }) {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  return h('div', { className:'toast-wrap' },
    toasts.map(t =>
      h('div', { key:t.id, className:`toast toast-${t.type}` },
        h('span', null, icons[t.type] || 'ℹ️'),
        h('div', { style:{flex:1} },
          h('div', { style:{fontWeight:700,fontSize:13} }, t.msg),
          t.body && h('div', { style:{fontSize:12,color:C[500],marginTop:2} }, t.body)
        ),
        h('button', { onClick:()=>remove(t.id), style:{background:'none',border:'none',cursor:'pointer',fontSize:18,color:C[400]} }, '×')
      )
    )
  );
}

/* ── useToastState ── */
function useToastState() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback(t => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, ...t }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 4000);
  }, []);
  const remove = useCallback(id => setToasts(p => p.filter(x => x.id !== id)), []);
  return { toasts, add, remove };
}

/* ── Spin ── */
function Spin({ sz=20, clr=C.purple }) {
  return h('div', { className:'spinner', style:{width:sz,height:sz,borderColor:`${clr}30`,borderTopColor:clr} });
}

/* ── Badge ── */
function Badge({ status }) {
  const cls = { verified:'badge-verified', pending:'badge-pending', rejected:'badge-rejected', active:'badge-active', suspended:'badge-suspended' };
  const labels = { verified:'Verified', pending:'Pending', rejected:'Rejected', active:'Active', suspended:'Suspended' };
  return h('span', { className:`badge ${cls[status]||''}` }, labels[status] || status);
}

/* ── TBadge ── */
function TBadge({ level }) {
  const c = tlC(level);
  return h('span', { style:{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 11px',borderRadius:100,background:c+'18',border:`1px solid ${c}40`,color:c,fontSize:11,fontWeight:700} },
    `🛡 L${level} · ${tlN(level)}`
  );
}

/* ── ScoreRing ── */
function ScoreRing({ score, size=100 }) {
  const r = size/2-10, circ = 2*Math.PI*r;
  const c = tlC(score>=800?5:score>=600?4:score>=400?3:score>=200?2:1);
  return h('div', { style:{position:'relative',width:size,height:size,flexShrink:0} },
    h('svg', { width:size, height:size, style:{transform:'rotate(-90deg)'} },
      h('circle', { cx:size/2, cy:size/2, r, fill:'none', stroke:C[200], strokeWidth:7 }),
      h('circle', { cx:size/2, cy:size/2, r, fill:'none', stroke:c, strokeWidth:7,
        strokeDasharray:circ, strokeDashoffset:circ*(1-score/1000), strokeLinecap:'round' })
    ),
    h('div', { style:{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'} },
      h('span', { style:{fontSize:size*0.2,fontWeight:900,color:c,lineHeight:1} }, score),
      h('span', { style:{fontSize:size*0.1,color:C[500],fontWeight:600} }, '/1000')
    )
  );
}

/* ── StatCard ── */
function StatCard({ icon, label, value, color=C.purple, delta }) {
  return h('div', { className:'stat-card' },
    h('div', { style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14} },
      h('div', { style:{width:44,height:44,borderRadius:12,background:color+'15',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22} }, icon),
      delta !== undefined && h('span', { style:{fontSize:12,fontWeight:700,color:delta>=0?C.green:C.red} },
        `${delta>=0?'↑':'↓'} ${Math.abs(delta)}%`)
    ),
    h('div', { className:'stat-value' }, value),
    h('div', { className:'stat-label' }, label)
  );
}

/* ── Modal ── */
function Modal({ open, onClose, title, children, width=500 }) {
  if (!open) return null;
  return h('div', { className:'modal-backdrop', onClick:onClose },
    h('div', { className:'modal', style:{maxWidth:width}, onClick:e=>e.stopPropagation() },
      h('div', { className:'modal-header' },
        h('span', { className:'modal-title' }, title),
        h('button', { onClick:onClose, style:{width:32,height:32,borderRadius:8,background:C[100],border:'none',cursor:'pointer',fontSize:18,color:C[600]} }, '×')
      ),
      children
    )
  );
}

/* ── Btn ── */
function Btn({ label, onClick, v='primary', icon, loading, disabled, sm, full=true }) {
  const cls = ['btn', `btn-${v}`, sm?'btn-sm':'', full?'btn-full':''].filter(Boolean).join(' ');
  return h('button', { className:cls, onClick:!loading&&!disabled?onClick:undefined, disabled:disabled||loading },
    loading ? h(Spin, { sz:14, clr:v==='outline'?C.purple:'#fff' })
             : icon && h('span', { style:{fontSize:sm?13:15} }, icon),
    label
  );
}

/* ── Field ── */
function Field({ label:lbl, value, onChange, type='text', placeholder, icon, error, req }) {
  return h('div', { className:'field' },
    lbl && h('label', { className:'label' }, lbl, req && h('span', { style:{color:C.red,marginLeft:3} }, '*')),
    h('div', { style:{position:'relative'} },
      icon && h('span', { style:{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:15,pointerEvents:'none'} }, icon),
      h('input', { type, value, placeholder,
        onChange: e => onChange && onChange(e.target.value),
        className:`input${icon?' input-icon':''}`,
        style:error?{borderColor:C.red}:{} })
    ),
    error && h('div', { style:{color:C.red,fontSize:11,marginTop:4} }, error)
  );
}

/* ── Sel ── */
function Sel({ label:lbl, value, onChange, options, ph }) {
  return h('div', null,
    lbl && h('label', { className:'label' }, lbl),
    h('select', { value, onChange:e=>onChange(e.target.value), className:'input' },
      ph && h('option', { value:'' }, ph),
      options.map(o => h('option', { key:typeof o==='string'?o:o.v, value:typeof o==='string'?o:o.v },
        typeof o==='string'?o:o.l))
    )
  );
}

/* ── PageHeader ── */
function PH({ title, sub, actions }) {
  return h('div', { className:'page-header' },
    h('div', null,
      h('h1', { className:'page-title' }, title),
      sub && h('p', { className:'page-sub' }, sub)
    ),
    actions && h('div', { style:{display:'flex',gap:10} }, actions)
  );
}

/* ── Sidebar ── */
function Sidebar({ active, isAdmin, onNav, user, onLogout }) {
  const userNav = [
    { id:'dashboard', ic:'🏠', lb:'Dashboard' },
    { id:'trustid',   ic:'🛡️', lb:'My TrustID' },
    { id:'documents', ic:'📁', lb:'Documents' },
    { id:'expenses',  ic:'💰', lb:'Expenses' },
    { id:'reminders', ic:'🔔', lb:'Reminders' },
    { id:'todo',      ic:'✅', lb:'To-Do List' },
    { id:'calendar',  ic:'📅', lb:'Calendar' },
  ];
  const adminNav = [
    { id:'admin-dashboard', ic:'📊', lb:'Overview' },
    { id:'admin-users',     ic:'👥', lb:'Users' },
    { id:'admin-docs',      ic:'📋', lb:'Verification Queue' },
    { id:'admin-trustids',  ic:'🛡️', lb:'TrustID Registry' },
  ];
  const botNav = [
    { id:'profile',  ic:'👤', lb:'Profile' },
    { id:'settings', ic:'⚙️', lb:'Settings' },
  ];
  const items = isAdmin ? adminNav : userNav;
  const ini = ((user?.firstName||'')[0]||'') + ((user?.lastName||'')[0]||'');

  const NavItem = ({ item }) => {
    const sel = active === item.id;
    return h('button', {
      className: `nav-item${sel?' active':''}`,
      onClick: () => onNav(item.id),
    },
      h('span', { style:{fontSize:17,width:20,textAlign:'center',flexShrink:0} }, item.ic),
      h('span', { style:{flex:1} }, item.lb),
      sel && h('div', { style:{width:5,height:5,borderRadius:'50%',background:'rgba(255,255,255,0.7)'} })
    );
  };

  return h('div', { className:'sidebar' },
    h('div', { className:'sidebar-logo' },
      h('div', { style:{display:'flex',alignItems:'center',gap:10} },
        h('div', { style:{width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,${C.purple},${C.purpleL})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20} }, '🛡️'),
        h('div', null,
          h('div', { style:{color:'#fff',fontWeight:900,fontSize:17} }, 'TrustID'),
          h('div', { style:{color:'rgba(255,255,255,0.35)',fontSize:9,fontWeight:700,letterSpacing:1.2} }, isAdmin?'ADMIN PORTAL':'PLATFORM')
        )
      )
    ),
    h('div', { className:'sidebar-nav' },
      items.map(item => h(NavItem, { key:item.id, item })),
      h('div', { style:{height:1,background:'rgba(255,255,255,0.07)',margin:'10px 0'} }),
      h('div', { style:{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.28)',letterSpacing:1.2,padding:'0 13px',marginBottom:7} }, 'ACCOUNT'),
      botNav.map(item => h(NavItem, { key:item.id, item }))
    ),
    h('div', { className:'sidebar-user' },
      h('div', { style:{width:38,height:38,borderRadius:'50%',background:`linear-gradient(135deg,${C.purple},${C.purpleL})`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:13,flexShrink:0} }, ini||'U'),
      h('div', { style:{flex:1,overflow:'hidden'} },
        h('div', { style:{color:'#fff',fontWeight:600,fontSize:12,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'} }, `${user?.firstName||''} ${user?.lastName||''}`),
        h('div', { style:{color:'rgba(255,255,255,0.38)',fontSize:10} }, user?.role==='admin'?'Administrator':'User')
      ),
      h('button', { onClick:onLogout, title:'Sign out', style:{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)',fontSize:17,padding:4} }, '↩')
    )
  );
}

/* ── TopBar ── */
function TopBar({ title, user }) {
  const ini = ((user?.firstName||'')[0]||'') + ((user?.lastName||'')[0]||'');
  return h('div', { className:'top-bar' },
    h('span', { style:{fontSize:18,fontWeight:900,color:C[900]} }, title),
    h('div', { style:{display:'flex',alignItems:'center',gap:14} },
      h('div', { style:{position:'relative'} },
        h('span', { style:{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:14} }, '🔍'),
        h('input', { placeholder:'Search...', className:'input input-icon', style:{width:210,height:37,background:C[50],border:`1px solid ${C[200]}`} })
      ),
      h('div', { style:{width:40,height:40,borderRadius:'50%',background:`linear-gradient(135deg,${C.purple},${C.purpleL})`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:14} }, ini||'U')
    )
  );
}

/* ── AppLayout ── */
function AppLayout({ activePage, children }) {
  const user    = Auth.getUser();
  const isAdmin = user?.role === 'admin';
  const { toasts, add, remove } = useToastState();

  const navigate = id => {
    const file = ROUTES[id];
    if (!file) return;
    const base = window.location.pathname.includes('/admin/') ? '../' : './';
    window.location.href = base + file;
  };

  return h(ToastCtx.Provider, { value: add },
    h(Toasts, { toasts, remove }),
    h(Sidebar, { active:activePage, isAdmin, onNav:navigate, user, onLogout:Auth.logout }),
    h('div', { className:'main-wrap' },
      h(TopBar, { title:PAGE_TITLES[activePage]||'TrustID', user }),
      h('div', { className:'page-content' },
        typeof children === 'function' ? children(add) : children
      )
    )
  );
}
