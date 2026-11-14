import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { supabase } from './lib/supabase';
import { Activity, Bell, BookOpen, ChevronRight, GraduationCap, LayoutDashboard, LogOut, Megaphone, Plus, School, ShieldCheck, Users, Pencil, UserX } from 'lucide-react';
import './admin.css';

type Tab = 'dashboard' | 'students' | 'teachers' | 'learning' | 'admissions' | 'notices' | 'settings';
type ClassGroup = { id: string; code: string; name_en: string; name_or: string; sort_order: number };
type StudentImportRow = { student_name: string; class_id: string; roll_no: string | null; dob: string | null; father_name: string | null; mother_name: string | null; mobile_number: string | null };
type Student = { id: string; student_name: string; roll_no: string | null; mobile_number: string | null; active: boolean; class_id: string; dob?: string | null; father_name?: string | null; mother_name?: string | null };
type Enquiry = { id: string; student_name: string; parent_name: string; mobile_number: string; class_applied: string; status: string; created_at: string };
type TeacherProfile = { auth_user_id: string; full_name: string; phone_number: string; employee_code: string | null; designation: string; active: boolean };\ntype LearningNote = { id: string; title: string; subject: string; medium: string; class_id: string; content: unknown; created_at: string };
const labels: Record<Tab, string> = { dashboard: 'Dashboard', students: 'Students', teachers: 'Teachers', learning: 'Learning Review', admissions: 'Admission Enquiries', notices: 'Notices', settings: 'School Settings' };

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field.trim()); field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field.trim()); field = '';
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}
function normalizeCsvKey(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/[\s_\-]+/g, '');
}


export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [adminName, setAdminName] = useState('Administrator');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [counts, setCounts] = useState({ students: 0, teachers: 0, enquiries: 0, notices: 0 });
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);\n  const [pendingNotes, setPendingNotes] = useState<LearningNote[]>([]);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState({ student_name: '', class_id: '', roll_no: '', dob: '', father_name: '', mother_name: '', mobile_number: '' });
  const [showTeacherForm, setShowTeacherForm] = useState(false);
  const [teacherForm, setTeacherForm] = useState({ full_name: '', phone_number: '', password: '', employee_code: '', designation: 'Teacher', qualification: '', subject: '' });
  const [teacherClassIds, setTeacherClassIds] = useState<string[]>([]);
  const [noticeForm, setNoticeForm] = useState({ title: '', body: '', audience: 'all' });
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<StudentImportRow[]>([]);
  const [importIssueCount, setImportIssueCount] = useState(0);
  const [importFileName, setImportFileName] = useState('');
  const [importBusy, setImportBusy] = useState(false);

  const verifyAdmin = useCallback(async (userId: string) => {
    if (!supabase) return false;
    const { data, error: profileError } = await supabase.from('user_profiles').select('role,display_name,active').eq('auth_user_id', userId).maybeSingle();
    if (profileError || !data || data.role !== 'admin' || !data.active) return false;
    setAdminName(data.display_name || 'Administrator');
    return true;
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    const [s, t, e, n, classResult, studentResult, teacherResult, enquiryResult, noteResult] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher').eq('active', true),
      supabase.from('admission_enquiries').select('*', { count: 'exact', head: true }),
      supabase.from('notices').select('*', { count: 'exact', head: true }),
      supabase.from('class_groups').select('id,code,name_en,name_or,sort_order').order('sort_order'),
      supabase.from('students').select('id,student_name,roll_no,mobile_number,active,class_id,dob,father_name,mother_name').order('student_name').limit(500),
      supabase.from('teacher_details').select('auth_user_id,full_name,phone_number,employee_code,designation,active').order('full_name').limit(100),
      supabase.from('admission_enquiries').select('id,student_name,parent_name,mobile_number,class_applied,status,created_at').order('created_at', { ascending: false }).limit(100)
    ]);
    setCounts({ students: s.count || 0, teachers: t.count || 0, enquiries: e.count || 0, notices: n.count || 0 });
    if (classResult.data) setGroups(classResult.data as ClassGroup[]);
    if (studentResult.data) setStudents(studentResult.data as Student[]);
    if (teacherResult.data) setTeachers(teacherResult.data as TeacherProfile[]);
    if (enquiryResult.data) setEnquiries(enquiryResult.data as Enquiry[]);\n    if (noteResult.data) setPendingNotes(noteResult.data as LearningNote[]);
    const failed = [s.error,t.error,e.error,n.error,classResult.error,studentResult.error,teacherResult.error,enquiryResult.error,noteResult.error].find(Boolean);
    if (failed) setError('Some Admin data could not be loaded. Check the database permissions and refresh.');
  }, []);

  useEffect(() => {
    let alive = true;
    async function init() {
      if (!supabase) { if (alive) { setError('Supabase configuration is missing. Add the project URL and publishable key to the hosting environment.'); setChecking(false); } return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const ok = await verifyAdmin(session.user.id);
        if (alive) setAuthorized(ok);
        if (alive && ok) await loadData();
        if (alive && !ok) { await supabase.auth.signOut(); setError('This account is not authorized as the school Admin.'); }
      }
      if (alive) setChecking(false);
    }
    void init();
    return () => { alive = false; };
  }, [loadData, verifyAdmin]);

  async function signIn(event: FormEvent) {
    event.preventDefault(); if (!supabase) return;
    const adminEmail = import.meta.env.VITE_ADMIN_LOGIN_EMAIL?.trim();
    if (!adminEmail) { setError('Admin login is not configured. An authorized school administrator must set VITE_ADMIN_LOGIN_EMAIL in the hosting environment.'); return; }
    setBusy(true); setError(''); setMessage('');
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: adminEmail, password });
    if (authError || !data.user) setError('Login failed. Check the Admin password or the configured account.');
    else {
      const ok = await verifyAdmin(data.user.id);
      if (!ok) { await supabase.auth.signOut(); setError('This account is not authorized as the school Admin.'); }
      else { setAuthorized(true); await loadData(); }
    }
    setBusy(false);
  }
  async function signOut() { if (supabase) await supabase.auth.signOut(); setAuthorized(false); setTab('dashboard'); setPassword(''); setError(''); setMessage(''); }

  function startEditStudent(student: Student) {
    setEditingStudentId(student.id);
    setStudentForm({ student_name: student.student_name, class_id: student.class_id, roll_no: student.roll_no || '', dob: student.dob || '', father_name: student.father_name || '', mother_name: student.mother_name || '', mobile_number: student.mobile_number || '' });
    setShowStudentForm(true); setError(''); setMessage('');
  }
  function resetStudentForm() {
    setEditingStudentId(null); setStudentForm({ student_name: '', class_id: '', roll_no: '', dob: '', father_name: '', mother_name: '', mobile_number: '' }); setShowStudentForm(false);
  }
  async function saveStudent(event: FormEvent) {
    event.preventDefault(); if (!supabase || !studentForm.class_id) return;
    setBusy(true); setError(''); setMessage('');
    const record = { student_name: studentForm.student_name.trim(), class_id: studentForm.class_id, roll_no: studentForm.roll_no.trim() || null, dob: studentForm.dob || null, father_name: studentForm.father_name.trim() || null, mother_name: studentForm.mother_name.trim() || null, mobile_number: studentForm.mobile_number.trim() || null };
    const result = editingStudentId ? await supabase.from('students').update(record).eq('id', editingStudentId) : await supabase.from('students').insert(record);
    if (result.error) setError('Student could not be saved. Check the details and Admin permissions.');
    else { setMessage(editingStudentId ? 'Student record updated.' : 'Student record added.'); resetStudentForm(); await loadData(); }
    setBusy(false);
  }
  async function deactivateStudent(student: Student) {
    if (!supabase || !window.confirm('Mark this student inactive? Their fee and exam history will be preserved.')) return;
    setBusy(true); setError(''); setMessage('');
    const { error: updateError } = await supabase.from('students').update({ active: false }).eq('id', student.id);
    if (updateError) setError('Could not update student status.');
    else { setMessage('Student marked inactive. Existing records were preserved.'); await loadData(); }
    setBusy(false);
  }

  async function prepareStudentCsv(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setError(''); setMessage(''); setImportPreview([]); setImportIssueCount(0);
    if (file.size > 2 * 1024 * 1024) { setError('CSV file is too large. Please keep it under 2 MB.'); input.value = ''; return; }
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') { setError('Please choose a CSV file.'); input.value = ''; return; }
    try {
      const rows = parseCsvRows((await file.text()).replace(/^\uFEFF/, ''));
      if (rows.length < 2) throw new Error('The CSV file has no student rows.');
      const headers = rows[0].map(normalizeCsvKey);
      const findColumn = (...names: string[]) => headers.findIndex((h) => names.includes(h));
      const nameCol = findColumn('studentname', 'name');
      const classCol = findColumn('classcode', 'classname', 'class', 'classgroup');
      if (nameCol < 0 || classCol < 0) throw new Error('CSV needs student_name and class_code or class_name columns.');
      const col = {
        roll: findColumn('rollno', 'rollnumber'),
        dob: findColumn('dob', 'dateofbirth'),
        father: findColumn('fathername', 'father'),
        mother: findColumn('mothername', 'mother'),
        mobile: findColumn('mobilenumber', 'mobile', 'phone')
      };
      const classMap = new Map<string, string>();
      groups.forEach((group) => [group.code, group.name_en, group.name_or].forEach((name) => classMap.set(normalizeCsvKey(name), group.id)));
      const preview: StudentImportRow[] = [];
      let issues = 0;
      for (const cells of rows.slice(1)) {
        const value = (index: number) => index < 0 ? '' : (cells[index] || '').trim();
        const student_name = value(nameCol);
        const class_id = classMap.get(normalizeCsvKey(value(classCol)));
        if (!student_name || !class_id) { issues += 1; continue; }
        const dobValue = value(col.dob);
        const dob = dobValue || null;
        if (dob) { const parts = dob.split('-').map(Number); const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])); if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || date.getUTCFullYear() !== parts[0] || date.getUTCMonth() !== parts[1] - 1 || date.getUTCDate() !== parts[2]) { issues += 1; continue; } }
        const mobileValue = value(col.mobile).replace(/\D/g, '');
        if (mobileValue && mobileValue.length !== 10) { issues += 1; continue; }
        preview.push({
          student_name,
          class_id,
          roll_no: value(col.roll) || null,
          dob,
          father_name: value(col.father) || null,
          mother_name: value(col.mother) || null,
          mobile_number: mobileValue || null
        });
      }
      if (!preview.length) throw new Error('No valid student rows found. Check the class names/codes and required columns.');
      setImportPreview(preview); setImportIssueCount(issues); setImportFileName(file.name);
      setMessage('CSV checked. Review the valid row count before importing. No records have been saved yet.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this CSV file.');
    } finally {
      input.value = '';
    }
  }

  async function confirmStudentImport() {
    if (!supabase || !importPreview.length) return;
    setImportBusy(true); setError(''); setMessage('');
    const { data: existing, error: existingError } = await supabase.from('students').select('student_name,class_id,roll_no,dob,mobile_number').limit(5000);
    if (existingError || !existing) {
      setError('Could not check existing records. Nothing was imported.');
      setImportBusy(false); return;
    }
    const keyFor = (row: { student_name: string; class_id: string; roll_no?: string | null; dob?: string | null; mobile_number?: string | null }) =>
      row.roll_no ? row.class_id + '|roll|' + normalizeCsvKey(row.roll_no) :
      row.class_id + '|' + normalizeCsvKey(row.student_name) + '|' + (row.dob || '') + '|' + (row.mobile_number || '');
    const seen = new Set(existing.map(keyFor));
    const uniqueRows = importPreview.filter((row) => {
      const key = keyFor(row);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    const duplicateCount = importPreview.length - uniqueRows.length;
    let inserted = 0;
    let failed = false;
    for (let offset = 0; offset < uniqueRows.length; offset += 50) {
      const batch = uniqueRows.slice(offset, offset + 50);
      const { error: insertError } = await supabase.from('students').insert(batch);
      if (insertError) {
        setError('Import stopped after ' + inserted + ' records. The remaining rows were not imported. Check Admin permissions and retry; already imported rows will be detected as duplicates.');
        failed = true;
        break;
      }
      inserted += batch.length;
    }
    if (!failed && (inserted > 0 || uniqueRows.length === 0)) {
      setMessage('Import finished: ' + inserted + ' added, ' + duplicateCount + ' duplicates skipped, ' + importIssueCount + ' invalid rows skipped. Fee figures are intentionally not imported by this student-profile tool.');
      setImportPreview([]); setImportIssueCount(0); setImportFileName('');
      await loadData();
    }
    setImportBusy(false);
  }

  async function createTeacher(event: FormEvent) {
    event.preventDefault(); if (!supabase || !teacherClassIds.length) return;
    setBusy(true); setError(''); setMessage('');
    const { data, error: invokeError } = await supabase.functions.invoke('admin-create-teacher', { body: { ...teacherForm, class_ids: teacherClassIds } });
    if (invokeError || data?.error) setError(data?.error || invokeError?.message || 'Teacher account could not be created.');
    else { setMessage('Teacher account and class assignments created. Share the initial password privately with the teacher.'); setTeacherForm({ full_name: '', phone_number: '', password: '', employee_code: '', designation: 'Teacher', qualification: '', subject: '' }); setTeacherClassIds([]); setShowTeacherForm(false); await loadData(); }
    setBusy(false);
  }
  async function reviewLearningNote(note: LearningNote, decision: 'published' | 'rejected') {\n    if (!supabase) return;\n    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;\n    setBusy(true); setError(''); setMessage('');\n    const patch = decision === 'published' ? { status: 'published', approved_by: user.id, published_at: new Date().toISOString() } : { status: 'rejected', approved_by: user.id };\n    const { error: updateError } = await supabase.from('daily_notes').update(patch).eq('id', note.id).eq('status','pending_review');\n    if (updateError) setError('Learning note review failed. Please retry.');\n    else { setMessage(decision === 'published' ? 'Learning note published for its class.' : 'Learning note rejected.'); await loadData(); }\n    setBusy(false);\n  }\n\n  async function publishNotice(event: FormEvent) {
    event.preventDefault(); if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    setBusy(true); setError(''); setMessage('');
    const { error: insertError } = await supabase.from('notices').insert({ title: noticeForm.title.trim(), body: noticeForm.body.trim(), audience: noticeForm.audience, published: true, created_by: user.id });
    if (insertError) setError('Notice could not be published. Please check Admin permissions.');
    else { setNoticeForm({ title: '', body: '', audience: 'all' }); setMessage('Notice published.'); await loadData(); }
    setBusy(false);
  }

  if (checking) return <div className="admin-loading">Checking secure Admin session…</div>;
  if (!authorized) return <div className="admin-login-wrap"><form className="admin-login-card" onSubmit={signIn}>
    <div className="admin-brand-mark"><School size={28}/></div><span className="admin-eyebrow">SSVM SANKHULA · SECURE ACCESS</span><h1>Admin Login</h1>
    <p>Only the authorized school administrator can access this control panel.</p>
    {error && <div className="admin-alert error">{error}</div>}
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password"/></label>
    <button className="admin-primary" disabled={busy}>{busy?'Verifying…':'Secure Login'}</button><a href="/" className="admin-back">← Back to school website</a>
    <small>Admin accounts are provisioned privately. Login requires only the Admin password; the official account email is configured securely by the school administrator.</small>
  </form></div>;

  const nav: { id: Tab; icon: typeof LayoutDashboard }[] = [{id:'dashboard',icon:LayoutDashboard},{id:'students',icon:GraduationCap},{id:'teachers',icon:Users},{id:'learning',icon:BookOpen},{id:'admissions',icon:BookOpen},{id:'notices',icon:Megaphone},{id:'settings',icon:ShieldCheck}];
  return <div className="admin-shell">
    <aside className="admin-sidebar"><div className="admin-side-brand"><div className="admin-brand-mark"><School/></div><div><b>SSVM SANKHULA</b><small>Digital Campus</small></div></div><span className="admin-side-label">MAIN MENU</span>
      {nav.map(item=>{const Icon=item.icon;return <button key={item.id} className={tab===item.id?'active':''} onClick={()=>{setTab(item.id);setError('');setMessage('')}}><Icon size={18}/>{labels[item.id]}{tab===item.id&&<ChevronRight size={15}/>}</button>})}
      <div className="admin-side-bottom"><span><span className="admin-live-dot"/> Secure Admin Session</span><button onClick={signOut}><LogOut size={17}/> Sign out</button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><span className="admin-eyebrow">SCHOOL MANAGEMENT</span><h1>{labels[tab]}</h1></div><div className="admin-user"><div className="admin-avatar">A</div><div><b>{adminName}</b><small>Administrator</small></div></div></header>
      {error&&<div className="admin-alert error">{error}</div>}{message&&<div className="admin-alert success">{message}</div>}
      {tab==='dashboard'&&<><section className="admin-welcome"><div><span>WELCOME BACK</span><h2>{adminName}</h2><p>Manage your school campus from one secure place.</p></div><div className="admin-welcome-icon"><Activity size={36}/></div></section>
        <section className="admin-stats"><article><span className="stat-icon green"><GraduationCap/></span><small>Total Students</small><strong>{counts.students}</strong><em>Registered records</em></article><article><span className="stat-icon blue"><Users/></span><small>Active Teachers</small><strong>{counts.teachers}</strong><em>Teacher accounts</em></article><article><span className="stat-icon amber"><BookOpen/></span><small>Admission Enquiries</small><strong>{counts.enquiries}</strong><em>Received enquiries</em></article><article><span className="stat-icon violet"><Bell/></span><small>Notices</small><strong>{counts.notices}</strong><em>Campus notices</em></article></section>
        <section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Quick Actions</h3><p>Common school administration tasks</p></div></div><div className="admin-quick-grid"><button onClick={()=>{setTab('students');setShowStudentForm(true)}}><GraduationCap/><b>Add Student</b><small>Create a real student record</small></button><button onClick={()=>{setTab('teachers');setShowTeacherForm(true)}}><Users/><b>Add Teacher</b><small>Create secure teacher access</small></button><button onClick={()=>setTab('admissions')}><BookOpen/><b>Admission Enquiries</b><small>Review new enquiries</small></button><button onClick={()=>setTab('notices')}><Megaphone/><b>Publish Notice</b><small>Share school announcements</small></button></div></section>
        <section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Campus Structure</h3><p>All 13 school class groups</p></div><span className="admin-count-pill">{groups.length} classes</span></div><div className="admin-class-list">{groups.map(g=><span key={g.id}>{g.name_en}</span>)}</div></section></>}
      {tab==='students'&&<section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Student Records</h3><p>Admin-managed records. No demo data is created.</p></div><button className="admin-primary compact" onClick={()=>{resetStudentForm();setShowStudentForm(true)}}><Plus size={16}/> Add Student</button></div>

        <div className="student-import-panel">
          <div><b>Import verified student CSV</b><p>Upload a CSV with student_name and class_code or class_name. Optional columns: roll_no, dob, father_name, mother_name, mobile_number. Files stay in this browser; student records are saved only after you confirm.</p></div>
          <input ref={importFileRef} type="file" accept=".csv,text/csv" hidden onChange={prepareStudentCsv}/>
          <button type="button" className="admin-secondary" onClick={()=>importFileRef.current?.click()} disabled={importBusy}>Choose CSV file</button>
          {importFileName && <small>Selected: {importFileName}</small>}
          {importPreview.length > 0 && <div className="student-import-review">
            <strong>{importPreview.length} valid rows ready</strong>
            <span>{importIssueCount} invalid rows will be skipped. Existing duplicates will be checked again before saving.</span>
            <small>Preview: {importPreview.slice(0, 5).map((row)=>row.student_name).join(', ')}</small>
            <div className="admin-form-actions"><button type="button" className="admin-secondary" onClick={()=>{setImportPreview([]);setImportFileName('');setImportIssueCount(0)}} disabled={importBusy}>Cancel import</button><button type="button" className="admin-primary" onClick={confirmStudentImport} disabled={importBusy}>{importBusy?'Importing…':'Confirm import'}</button></div>
          </div>}
          <small>Privacy: do not upload this CSV to public GitHub. This tool does not import fee balances; those will be handled in the fee ledger separately.</small>
        </div>
        {showStudentForm&&<form className="admin-student-form" onSubmit={saveStudent}><label>Student Name<input required value={studentForm.student_name} onChange={e=>setStudentForm({...studentForm,student_name:e.target.value})}/></label><label>Class<select required value={studentForm.class_id} onChange={e=>setStudentForm({...studentForm,class_id:e.target.value})}><option value="">Select class</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name_en}</option>)}</select></label><label>Roll Number<input value={studentForm.roll_no} onChange={e=>setStudentForm({...studentForm,roll_no:e.target.value})}/></label><label>Date of Birth<input type="date" value={studentForm.dob} onChange={e=>setStudentForm({...studentForm,dob:e.target.value})}/></label><label>Father Name<input value={studentForm.father_name} onChange={e=>setStudentForm({...studentForm,father_name:e.target.value})}/></label><label>Mother Name<input value={studentForm.mother_name} onChange={e=>setStudentForm({...studentForm,mother_name:e.target.value})}/></label><label>Mobile Number<input inputMode="numeric" maxLength={10} value={studentForm.mobile_number} onChange={e=>setStudentForm({...studentForm,mobile_number:e.target.value.replace(/\D/g,'').slice(0,10)})}/></label><div className="admin-form-actions"><button type="button" className="admin-secondary" onClick={resetStudentForm}>Cancel</button><button className="admin-primary" disabled={busy}>{busy?'Saving…':editingStudentId?'Update Student':'Save Student'}</button></div></form>}
        <div className="admin-table-wrap"><table><thead><tr><th>Student</th><th>Roll No.</th><th>Class</th><th>Mobile</th><th>Status</th><th>Actions</th></tr></thead><tbody>{students.map(s=><tr key={s.id}><td>{s.student_name}</td><td>{s.roll_no||'—'}</td><td>{groups.find(g=>g.id===s.class_id)?.name_en||'—'}</td><td>{s.mobile_number||'—'}</td><td><span className={s.active?'status-active':'status-inactive'}>{s.active?'Active':'Inactive'}</span></td><td><div className="admin-row-actions"><button type="button" title="Edit student" onClick={()=>startEditStudent(s)}><Pencil size={15}/></button>{s.active&&<button type="button" title="Mark inactive" onClick={()=>deactivateStudent(s)} disabled={busy}><UserX size={15}/></button>}</div></td></tr>)}</tbody></table>{students.length===0&&<div className="admin-empty">No student records yet. Add or import the school's verified list.</div>}</div>
      </section>}
      {tab==='teachers'&&<section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Teacher Accounts</h3><p>Create phone/password login and assign classes securely.</p></div><button className="admin-primary compact" onClick={()=>setShowTeacherForm(!showTeacherForm)}><Plus size={16}/> Add Teacher</button></div>
        {showTeacherForm&&<form className="admin-student-form" onSubmit={createTeacher}><label>Teacher Name<input required minLength={2} value={teacherForm.full_name} onChange={e=>setTeacherForm({...teacherForm,full_name:e.target.value})}/></label><label>Mobile Number<input required inputMode="numeric" maxLength={10} value={teacherForm.phone_number} onChange={e=>setTeacherForm({...teacherForm,phone_number:e.target.value.replace(/\D/g,'').slice(0,10)})}/></label><label>Initial Password<input required type="password" minLength={10} autoComplete="new-password" value={teacherForm.password} onChange={e=>setTeacherForm({...teacherForm,password:e.target.value})}/></label><label>Employee Code<input value={teacherForm.employee_code} onChange={e=>setTeacherForm({...teacherForm,employee_code:e.target.value})}/></label><label>Designation<input value={teacherForm.designation} onChange={e=>setTeacherForm({...teacherForm,designation:e.target.value})}/></label><label>Qualification<input value={teacherForm.qualification} onChange={e=>setTeacherForm({...teacherForm,qualification:e.target.value})}/></label><label>Subject<input required value={teacherForm.subject} onChange={e=>setTeacherForm({...teacherForm,subject:e.target.value})} placeholder="e.g. Mathematics"/></label><div className="teacher-class-picker"><b>Assigned Classes</b><div>{groups.map(g=><label key={g.id}><input type="checkbox" checked={teacherClassIds.includes(g.id)} onChange={e=>setTeacherClassIds(prev=>e.target.checked?[...prev,g.id]:prev.filter(id=>id!==g.id))}/>{g.name_en}</label>)}</div></div><div className="admin-form-actions"><button type="button" className="admin-secondary" onClick={()=>setShowTeacherForm(false)}>Cancel</button><button className="admin-primary" disabled={busy||teacherClassIds.length===0}>{busy?'Creating…':'Create Teacher Account'}</button></div></form>}
        <div className="admin-table-wrap"><table><thead><tr><th>Teacher</th><th>Phone</th><th>Employee Code</th><th>Designation</th><th>Status</th></tr></thead><tbody>{teachers.map(t=><tr key={t.auth_user_id}><td>{t.full_name}</td><td>{t.phone_number}</td><td>{t.employee_code||'—'}</td><td>{t.designation}</td><td><span className={t.active?'status-active':'status-inactive'}>{t.active?'Active':'Inactive'}</span></td></tr>)}</tbody></table>{teachers.length===0&&<div className="admin-empty">No teacher accounts yet. Create the first verified teacher account.</div>}</div>
      </section>}
      {tab==='learning'&&<section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Daily Learning Note Approval</h3><p>Review teacher submissions before they appear in the student learning area.</p></div><span className="admin-count-pill">{pendingNotes.length} pending</span></div>{pendingNotes.map(note=><article className="teacher-note-row" key={note.id}><div><b>{note.title}</b><span>{groups.find(g=>g.id===note.class_id)?.name_en||'Class'} · {note.subject} · {note.medium}</span><p>{typeof note.content==='object'&&note.content!==null&&'text' in note.content?String((note.content as {text:unknown}).text):JSON.stringify(note.content)}</p><small>{new Date(note.created_at).toLocaleString()}</small></div><div className="admin-row-actions"><button type="button" className="admin-primary compact" disabled={busy} onClick={()=>reviewLearningNote(note,'published')}>Approve & Publish</button><button type="button" className="admin-secondary" disabled={busy} onClick={()=>reviewLearningNote(note,'rejected')}>Reject</button></div></article>)}{pendingNotes.length===0&&<div className="admin-empty">No learning notes waiting for review.</div>}</section>}
      {tab==='admissions'&&<section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Admission Enquiries</h3><p>Recent public website enquiries</p></div></div><div className="admin-table-wrap"><table><thead><tr><th>Student</th><th>Parent</th><th>Mobile</th><th>Class</th><th>Status</th></tr></thead><tbody>{enquiries.map(e=><tr key={e.id}><td>{e.student_name}</td><td>{e.parent_name}</td><td>{e.mobile_number}</td><td>{e.class_applied}</td><td>{e.status}</td></tr>)}</tbody></table>{enquiries.length===0&&<div className="admin-empty">No admission enquiries received yet.</div>}</div></section>}
      {tab==='notices'&&<section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Publish a School Notice</h3><p>Notices are stored in the campus database.</p></div></div><form className="admin-notice-form" onSubmit={publishNotice}><label>Notice Title<input required value={noticeForm.title} onChange={e=>setNoticeForm({...noticeForm,title:e.target.value})}/></label><label>Message<textarea required rows={5} value={noticeForm.body} onChange={e=>setNoticeForm({...noticeForm,body:e.target.value})}/></label><label>Audience<select value={noticeForm.audience} onChange={e=>setNoticeForm({...noticeForm,audience:e.target.value})}><option value="all">Students and Teachers</option><option value="students">Students only</option><option value="teachers">Teachers only</option><option value="public">Public</option></select></label><button className="admin-primary" disabled={busy}>{busy?'Publishing…':'Publish Notice'}</button></form></section>}
      {tab==='settings'&&<section className="admin-panel-card"><div className="admin-card-heading"><div><h3>School Settings</h3><p>Protected configuration areas</p></div></div><div className="admin-settings-list"><div><ShieldCheck/><span><b>Admin security</b><small>Role is verified against the protected user_profiles table.</small></span><span className="status-active">Protected</span></div><div><School/><span><b>School identity</b><small>Logo, leadership, contact details and homepage content.</small></span><span className="status-inactive">Next build stage</span></div><div><Bell/><span><b>AI, payment and push credentials</b><small>Must be stored as server-side secrets, never in browser storage.</small></span><span className="status-inactive">Not configured</span></div></div></section>}
      <footer className="admin-footer">SSVM SANKHULA Digital Campus · Secure Administration</footer>
    </main>
  </div>;
}