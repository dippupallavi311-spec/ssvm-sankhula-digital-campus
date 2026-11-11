import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Activity, Bell, BookOpen, ChevronRight, GraduationCap, LayoutDashboard, LogOut, Megaphone, Plus, School, ShieldCheck, Users } from 'lucide-react';
import './admin.css';

type Tab = 'dashboard' | 'students' | 'teachers' | 'admissions' | 'notices' | 'settings';
type ClassGroup = { id: string; name_en: string; name_or: string; sort_order: number };
type Student = { id: string; student_name: string; roll_no: string | null; mobile_number: string | null; active: boolean; class_id: string };
type Enquiry = { id: string; student_name: string; parent_name: string; mobile_number: string; class_applied: string; status: string; created_at: string };
type TeacherProfile = { id: string; display_name: string | null; active: boolean };

const labels: Record<Tab, string> = {
  dashboard: 'Dashboard', students: 'Students', teachers: 'Teachers',
  admissions: 'Admission Enquiries', notices: 'Notices', settings: 'School Settings'
};

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminName, setAdminName] = useState('Administrator');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [counts, setCounts] = useState({ students: 0, teachers: 0, enquiries: 0, notices: 0 });
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [studentForm, setStudentForm] = useState({ student_name: '', class_id: '', roll_no: '', dob: '', father_name: '', mother_name: '', mobile_number: '' });
  const [noticeForm, setNoticeForm] = useState({ title: '', body: '', audience: 'all' });

  const verifyAdmin = useCallback(async (userId: string) => {
    if (!supabase) return false;
    const { data, error: profileError } = await supabase
      .from('user_profiles').select('role,display_name,active')
      .eq('auth_user_id', userId).maybeSingle();
    if (profileError || !data || data.role !== 'admin' || !data.active) return false;
    setAdminName(data.display_name || 'Administrator');
    return true;
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    const [s, t, e, n, classResult, studentResult, teacherResult, enquiryResult] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher').eq('active', true),
      supabase.from('admission_enquiries').select('*', { count: 'exact', head: true }),
      supabase.from('notices').select('*', { count: 'exact', head: true }),
      supabase.from('class_groups').select('id,name_en,name_or,sort_order').order('sort_order'),
      supabase.from('students').select('id,student_name,roll_no,mobile_number,active,class_id').order('student_name').limit(100),
      supabase.from('user_profiles').select('id,display_name,active').eq('role', 'teacher').order('display_name').limit(100),
      supabase.from('admission_enquiries').select('id,student_name,parent_name,mobile_number,class_applied,status,created_at').order('created_at', { ascending: false }).limit(100)
    ]);
    setCounts({ students: s.count || 0, teachers: t.count || 0, enquiries: e.count || 0, notices: n.count || 0 });
    if (classResult.data) setGroups(classResult.data as ClassGroup[]);
    if (studentResult.data) setStudents(studentResult.data as Student[]);
    if (teacherResult.data) setTeachers(teacherResult.data as TeacherProfile[]);
    if (enquiryResult.data) setEnquiries(enquiryResult.data as Enquiry[]);
  }, []);

  useEffect(() => {
    let alive = true;
    async function init() {
      if (!supabase) { if (alive) { setError('Supabase configuration is missing. Add the project URL and publishable key to the hosting environment.'); setChecking(false); } return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const ok = await verifyAdmin(session.user.id);
        if (alive && ok) await loadData();
        if (alive && !ok) {
          await supabase.auth.signOut();
          setError('This account is not authorized as the school Admin.');
        }
      }
      if (alive) setChecking(false);
    }
    void init();
    return () => { alive = false; };
  }, [loadData, verifyAdmin]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(''); setMessage('');
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError || !data.user) {
      setError('Login failed. Check the Admin email and password.');
    } else {
      const ok = await verifyAdmin(data.user.id);
      if (!ok) {
        await supabase.auth.signOut();
        setError('This account is not authorized as the school Admin. Ask the project administrator to provision the Admin role securely.');
      } else {
        await loadData();
      }
    }
    setBusy(false);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setTab('dashboard'); setPassword(''); setError(''); setMessage('');
  }

  async function addStudent(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !studentForm.class_id) return;
    setBusy(true); setError(''); setMessage('');
    const { error: insertError } = await supabase.from('students').insert({
      student_name: studentForm.student_name.trim(), class_id: studentForm.class_id,
      roll_no: studentForm.roll_no.trim() || null, dob: studentForm.dob || null,
      father_name: studentForm.father_name.trim() || null, mother_name: studentForm.mother_name.trim() || null,
      mobile_number: studentForm.mobile_number.trim() || null
    });
    if (insertError) setError('Student could not be saved. Check Admin permissions and the entered details.');
    else {
      setMessage('Student record saved.');
      setStudentForm({ student_name: '', class_id: '', roll_no: '', dob: '', father_name: '', mother_name: '', mobile_number: '' });
      setShowStudentForm(false); await loadData();
    }
    setBusy(false);
  }

  async function publishNotice(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setBusy(true); setError(''); setMessage('');
    const { error: insertError } = await supabase.from('notices').insert({
      title: noticeForm.title.trim(), body: noticeForm.body.trim(),
      audience: noticeForm.audience, published: true, created_by: user.id
    });
    if (insertError) setError('Notice could not be published. Please check Admin permissions.');
    else { setNoticeForm({ title: '', body: '', audience: 'all' }); setMessage('Notice published in the campus notice feed.'); await loadData(); }
    setBusy(false);
  }

  if (checking) return <div className="admin-loading">Checking secure Admin session…</div>;

  if (!supabase || !((globalThis as typeof globalThis & { __unused?: boolean }).__unused)) {
    // The login form remains available when Supabase is configured; authorization is checked after sign-in.
  }

  const signedIn = Boolean(supabase && adminName && !error && counts && (adminName !== ''));
  // A verified session is tracked by checking the current session on this component's state.
  const [authorized, setAuthorized] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const ok = await verifyAdmin(data.session.user.id);
        if (active) setAuthorized(ok);
      } else if (active) setAuthorized(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setAuthorized(false);
      else void verifyAdmin(session.user.id).then(setAuthorized);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [verifyAdmin]);

  if (!authorized) return <div className="admin-login-wrap">
    <form className="admin-login-card" onSubmit={signIn}>
      <div className="admin-brand-mark"><School size={28}/></div>
      <span className="admin-eyebrow">SSVM SANKHULA · SECURE ACCESS</span>
      <h1>Admin Login</h1>
      <p>Only the authorized school administrator can access this control panel.</p>
      {error && <div className="admin-alert error">{error}</div>}
      <label>Admin Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Admin email"/></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password"/></label>
      <button className="admin-primary" disabled={busy}>{busy ? 'Verifying…' : 'Secure Login'}</button>
      <a href="/" className="admin-back">← Back to school website</a>
      <small>Admin accounts are provisioned privately. There is no public Admin sign-up.</small>
    </form>
  </div>;

  const nav: { id: Tab; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', icon: LayoutDashboard }, { id: 'students', icon: GraduationCap },
    { id: 'teachers', icon: Users }, { id: 'admissions', icon: BookOpen },
    { id: 'notices', icon: Megaphone }, { id: 'settings', icon: ShieldCheck }
  ];

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <div className="admin-side-brand"><div className="admin-brand-mark"><School/></div><div><b>SSVM SANKHULA</b><small>Digital Campus</small></div></div>
      <span className="admin-side-label">MAIN MENU</span>
      {nav.map(item => { const Icon = item.icon; return <button key={item.id} className={tab===item.id?'active':''} onClick={()=>{setTab(item.id);setError('');setMessage('')}}><Icon size={18}/>{labels[item.id]}{tab===item.id&&<ChevronRight size={15}/>}</button>; })}
      <div className="admin-side-bottom"><span><span className="admin-live-dot"/> Secure Admin Session</span><button onClick={signOut}><LogOut size={17}/> Sign out</button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><span className="admin-eyebrow">SCHOOL MANAGEMENT</span><h1>{labels[tab]}</h1></div><div className="admin-user"><div className="admin-avatar">A</div><div><b>{adminName}</b><small>Administrator</small></div></div></header>
      {error && <div className="admin-alert error">{error}</div>}
      {message && <div className="admin-alert success">{message}</div>}
      {tab==='dashboard' && <>
        <section className="admin-welcome"><div><span>WELCOME BACK</span><h2>{adminName}</h2><p>Manage your school campus from one secure place.</p></div><div className="admin-welcome-icon"><Activity size={36}/></div></section>
        <section className="admin-stats">
          <article><span className="stat-icon green"><GraduationCap/></span><small>Total Students</small><strong>{counts.students}</strong><em>Registered records</em></article>
          <article><span className="stat-icon blue"><Users/></span><small>Active Teachers</small><strong>{counts.teachers}</strong><em>Teacher accounts</em></article>
          <article><span className="stat-icon amber"><BookOpen/></span><small>Admission Enquiries</small><strong>{counts.enquiries}</strong><em>Received enquiries</em></article>
          <article><span className="stat-icon violet"><Bell/></span><small>Notices</small><strong>{counts.notices}</strong><em>Campus notices</em></article>
        </section>
        <section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Quick Actions</h3><p>Common school administration tasks</p></div></div><div className="admin-quick-grid">
          <button onClick={()=>{setTab('students');setShowStudentForm(true)}}><GraduationCap/><b>Add Student</b><small>Create a real student record</small></button>
          <button onClick={()=>setTab('teachers')}><Users/><b>Teacher Management</b><small>Review teacher profiles</small></button>
          <button onClick={()=>setTab('admissions')}><BookOpen/><b>Admission Enquiries</b><small>Review new enquiries</small></button>
          <button onClick={()=>setTab('notices')}><Megaphone/><b>Publish Notice</b><small>Share school announcements</small></button>
        </div></section>
        <section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Campus Structure</h3><p>All 13 school class groups</p></div><span className="admin-count-pill">{groups.length} classes</span></div><div className="admin-class-list">{groups.map(g=><span key={g.id}>{g.name_en}</span>)}</div></section>
      </>}
      {tab==='students' && <section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Student Records</h3><p>Admin-managed student database. No demo records are added.</p></div><button className="admin-primary compact" onClick={()=>setShowStudentForm(!showStudentForm)}><Plus size={16}/> Add Student</button></div>
        {showStudentForm && <form className="admin-student-form" onSubmit={addStudent}><label>Student Name<input required value={studentForm.student_name} onChange={e=>setStudentForm({...studentForm,student_name:e.target.value})}/></label><label>Class<select required value={studentForm.class_id} onChange={e=>setStudentForm({...studentForm,class_id:e.target.value})}><option value="">Select class</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name_en}</option>)}</select></label><label>Roll Number<input value={studentForm.roll_no} onChange={e=>setStudentForm({...studentForm,roll_no:e.target.value})}/></label><label>Date of Birth<input type="date" value={studentForm.dob} onChange={e=>setStudentForm({...studentForm,dob:e.target.value})}/></label><label>Father Name<input value={studentForm.father_name} onChange={e=>setStudentForm({...studentForm,father_name:e.target.value})}/></label><label>Mother Name<input value={studentForm.mother_name} onChange={e=>setStudentForm({...studentForm,mother_name:e.target.value})}/></label><label>Mobile Number<input inputMode="numeric" value={studentForm.mobile_number} onChange={e=>setStudentForm({...studentForm,mobile_number:e.target.value})}/></label><div className="admin-form-actions"><button type="button" className="admin-secondary" onClick={()=>setShowStudentForm(false)}>Cancel</button><button className="admin-primary" disabled={busy}>{busy?'Saving…':'Save Student'}</button></div></form>}
        <div className="admin-table-wrap"><table><thead><tr><th>Student</th><th>Roll No.</th><th>Class</th><th>Mobile</th><th>Status</th></tr></thead><tbody>{students.map(s=><tr key={s.id}><td>{s.student_name}</td><td>{s.roll_no||'—'}</td><td>{groups.find(g=>g.id===s.class_id)?.name_en||'—'}</td><td>{s.mobile_number||'—'}</td><td><span className={s.active?'status-active':'status-inactive'}>{s.active?'Active':'Inactive'}</span></td></tr>)}</tbody></table>{students.length===0&&<div className="admin-empty">No student records yet. Add or import the school's verified student list.</div>}</div>
      </section>}
      {tab==='teachers' && <section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Teacher Accounts</h3><p>Authorized teacher profiles linked to Supabase Auth</p></div></div><div className="admin-table-wrap"><table><thead><tr><th>Teacher</th><th>Profile ID</th><th>Status</th></tr></thead><tbody>{teachers.map(t=><tr key={t.id}><td>{t.display_name||'Name not set'}</td><td>{t.id.slice(0,8)}…</td><td><span className={t.active?'status-active':'status-inactive'}>{t.active?'Active':'Inactive'}</span></td></tr>)}</tbody></table>{teachers.length===0&&<div className="admin-empty">No teacher profiles yet. Teacher account creation will be connected to the secure server-side account workflow.</div>}</div></section>}
      {tab==='admissions' && <section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Admission Enquiries</h3><p>Recent public website enquiries</p></div></div><div className="admin-table-wrap"><table><thead><tr><th>Student</th><th>Parent</th><th>Mobile</th><th>Class</th><th>Status</th></tr></thead><tbody>{enquiries.map(e=><tr key={e.id}><td>{e.student_name}</td><td>{e.parent_name}</td><td>{e.mobile_number}</td><td>{e.class_applied}</td><td>{e.status}</td></tr>)}</tbody></table>{enquiries.length===0&&<div className="admin-empty">No admission enquiries received yet.</div>}</div></section>}
      {tab==='notices' && <section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Publish a School Notice</h3><p>Notices are stored in the campus database.</p></div></div><form className="admin-notice-form" onSubmit={publishNotice}><label>Notice Title<input required value={noticeForm.title} onChange={e=>setNoticeForm({...noticeForm,title:e.target.value})}/></label><label>Message<textarea required rows={5} value={noticeForm.body} onChange={e=>setNoticeForm({...noticeForm,body:e.target.value})}/></label><label>Audience<select value={noticeForm.audience} onChange={e=>setNoticeForm({...noticeForm,audience:e.target.value})}><option value="all">Students and Teachers</option><option value="students">Students only</option><option value="teachers">Teachers only</option><option value="public">Public</option></select></label><button className="admin-primary" disabled={busy}>{busy?'Publishing…':'Publish Notice'}</button></form></section>}
      {tab==='settings' && <section className="admin-panel-card"><div className="admin-card-heading"><div><h3>School Settings</h3><p>Protected configuration areas</p></div></div><div className="admin-settings-list"><div><ShieldCheck/><span><b>Admin security</b><small>Role is verified against the protected user_profiles table.</small></span><span className="status-active">Protected</span></div><div><School/><span><b>School identity</b><small>Logo, leadership, contact details and homepage content.</small></span><span className="status-inactive">Next build stage</span></div><div><Bell/><span><b>AI, payment and push credentials</b><small>Must be stored as server-side secrets, never in browser storage.</small></span><span className="status-inactive">Not configured</span></div></div></section>}
      <footer className="admin-footer">SSVM SANKHULA Digital Campus · Secure Administration</footer>
    </main>
  </div>;
}
