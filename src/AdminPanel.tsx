import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { supabase } from './lib/supabase';
import { Activity, Bell, BookOpen, ChevronRight, GraduationCap, LayoutDashboard, LogOut, Megaphone, Plus, School, ShieldCheck, Users, Pencil, UserX } from 'lucide-react';
import './admin.css';

type Tab = 'dashboard' | 'students' | 'teachers' | 'learning' | 'fees' | 'exams' | 'admissions' | 'notices' | 'settings';
type ClassGroup = { id: string; code: string; name_en: string; name_or: string; sort_order: number };
type StudentImportRow = { student_name: string; class_id: string; roll_no: string | null; dob: string | null; father_name: string | null; mother_name: string | null; mobile_number: string | null };
type Student = { id: string; student_name: string; roll_no: string | null; mobile_number: string | null; active: boolean; class_id: string; dob?: string | null; father_name?: string | null; mother_name?: string | null };
type Enquiry = { id: string; student_name: string; parent_name: string; mobile_number: string; class_applied: string; status: string; created_at: string };
type TeacherProfile = { auth_user_id: string; full_name: string; phone_number: string; employee_code: string | null; designation: string; active: boolean };
type LearningNote = { id: string; title: string; subject: string; medium: string; class_id: string; content: unknown; created_at: string };
type FeeAssessment = { id: string; student_id: string; academic_year: string; fee_period: string; school_fee: number; tuition_fee: number; vehicle_fee: number; opening_paid: number; due_date: string | null; notes: string | null; students?: { student_name: string; roll_no: string | null } | null };
type FeePayment = { id:string; fee_assessment_id:string; student_id:string; amount:number; payment_method:string; transaction_reference:string|null; status:string; submitted_at:string; admin_note:string|null };
type OnlineExam = {id:string;class_id:string;subject:string;title:string;instructions:string|null;duration_minutes:number;start_at:string;end_at:string;total_marks:number;status:string;results_published:boolean;created_by:string};
type ExamQuestion = {id:string;exam_id:string;question_order:number;question_text:string;options:unknown;marks:number};
const labels: Record<Tab, string> = { dashboard: 'Dashboard', students: 'Students', teachers: 'Teachers', learning: 'Learning Review', fees: 'Fees Management', exams: 'Online Exams', admissions: 'Admission Enquiries', notices: 'Notices', settings: 'School Settings' };

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
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [pendingNotes, setPendingNotes] = useState<LearningNote[]>([]);
  const [feeAssessments, setFeeAssessments] = useState<FeeAssessment[]>([]);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [adminUserId, setAdminUserId] = useState('');
  const [paymentForm, setPaymentForm] = useState({fee_assessment_id:'',amount:'',payment_method:'Cash',transaction_reference:'',admin_note:''});
  const [onlineExams,setOnlineExams]=useState<OnlineExam[]>([]);
  const [examQuestions,setExamQuestions]=useState<ExamQuestion[]>([]);
  const [examForm,setExamForm]=useState({class_id:'',subject:'Odia',title:'',instructions:'',duration_minutes:'30',start_at:'',end_at:'',total_marks:'10'});
  const [questionForm,setQuestionForm]=useState({exam_id:'',question_text:'',option_a:'',option_b:'',option_c:'',option_d:'',correct_answer:'A',explanation:'',marks:'1'});
  const [feeForm, setFeeForm] = useState({ student_id: '', academic_year: '2026-27', fee_period: '2026-11', school_fee: '0', tuition_fee: '0', vehicle_fee: '0', opening_paid: '0', due_date: '', notes: '' });
  const feeImportRef = useRef<HTMLInputElement>(null);
  const [feeImportPreview, setFeeImportPreview] = useState<Array<{student_id:string;student_name:string;school_fee:number;tuition_fee:number;vehicle_fee:number;opening_paid:number}>>([]);
  const [feeImportIssues, setFeeImportIssues] = useState(0);
  const [feeImportName, setFeeImportName] = useState('');
  const [feeImportBusy, setFeeImportBusy] = useState(false);
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
    setAdminUserId(userId);
    return true;
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    const [s, t, e, n, classResult, studentResult, teacherResult, enquiryResult, noteResult, feeResult, paymentResult, examResult, questionResult] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher').eq('active', true),
      supabase.from('admission_enquiries').select('*', { count: 'exact', head: true }),
      supabase.from('notices').select('*', { count: 'exact', head: true }),
      supabase.from('class_groups').select('id,code,name_en,name_or,sort_order').order('sort_order'),
      supabase.from('students').select('id,student_name,roll_no,mobile_number,active,class_id,dob,father_name,mother_name').order('student_name').limit(500),
      supabase.from('teacher_details').select('auth_user_id,full_name,phone_number,employee_code,designation,active').order('full_name').limit(100),
      supabase.from('admission_enquiries').select('id,student_name,parent_name,mobile_number,class_applied,status,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('daily_notes').select('id,title,subject,medium,class_id,content,created_at').eq('status','pending_review').order('created_at',{ascending:false}).limit(100),
      supabase.from('fee_assessments').select('id,student_id,academic_year,fee_period,school_fee,tuition_fee,vehicle_fee,opening_paid,due_date,notes,students(student_name,roll_no)').order('fee_period',{ascending:false}).limit(500),
      supabase.from('fee_payments').select('id,fee_assessment_id,student_id,amount,payment_method,transaction_reference,status,submitted_at,admin_note').order('submitted_at',{ascending:false}).limit(500),
      supabase.from('online_exams').select('id,class_id,subject,title,instructions,duration_minutes,start_at,end_at,total_marks,status,results_published,created_by').order('created_at',{ascending:false}).limit(100),
      supabase.from('exam_questions').select('id,exam_id,question_order,question_text,options,marks').order('question_order').limit(1000)
    ]);
    setCounts({ students: s.count || 0, teachers: t.count || 0, enquiries: e.count || 0, notices: n.count || 0 });
    if (classResult.data) setGroups(classResult.data as ClassGroup[]);
    if (studentResult.data) setStudents(studentResult.data as Student[]);
    if (teacherResult.data) setTeachers(teacherResult.data as TeacherProfile[]);
    if (enquiryResult.data) setEnquiries(enquiryResult.data as Enquiry[]);
    if (noteResult.data) setPendingNotes(noteResult.data as LearningNote[]);
    if (feeResult.data) setFeeAssessments(feeResult.data as unknown as FeeAssessment[]);
    if (paymentResult.data) setFeePayments(paymentResult.data as FeePayment[]);
    if (examResult.data) setOnlineExams(examResult.data as OnlineExam[]);
    if (questionResult.data) setExamQuestions(questionResult.data as ExamQuestion[]);
    const failed = [s.error,t.error,e.error,n.error,classResult.error,studentResult.error,teacherResult.error,enquiryResult.error,noteResult.error,feeResult.error,paymentResult.error,examResult.error,questionResult.error].find(Boolean);
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
  async function prepareFeeCsv(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget; const file = input.files?.[0]; if (!file) return;
    setError(''); setMessage(''); setFeeImportPreview([]); setFeeImportIssues(0);
    if (file.size > 2 * 1024 * 1024) { setError('Fee CSV must be under 2 MB.'); input.value=''; return; }
    try {
      const rows = parseCsvRows((await file.text()).replace(/^\uFEFF/, ''));
      if (rows.length < 2) throw new Error('Fee CSV has no data rows.');
      const headers = rows[0].map(normalizeCsvKey);
      const col = (...names:string[]) => headers.findIndex(h=>names.includes(h));
      const ix = {name:col('studentname','name'), cls:col('classname','classcode','class'), roll:col('rollno','rollnumber'), school:col('schoolfee'), tuition:col('tuitionfee'), vehicle:col('vehiclefee'), paid:col('totalpaid','openingpaid')};
      if ([ix.name,ix.cls,ix.school,ix.tuition,ix.vehicle].some(i=>i<0)) throw new Error('CSV needs student_name, class_name, school_fee, tuition_fee and vehicle_fee columns.');
      const preview: Array<{student_id:string;student_name:string;school_fee:number;tuition_fee:number;vehicle_fee:number;opening_paid:number}> = [];
      let issues=0; const seenStudents=new Set<string>();
      for (const cells of rows.slice(1)) {
        const v=(i:number)=>i<0?'':(cells[i]||'').trim();
        const cls=groups.find(g=>[g.code,g.name_en,g.name_or].some(n=>normalizeCsvKey(n)===normalizeCsvKey(v(ix.cls))));
        const candidates=students.filter(s=>s.active&&s.class_id===cls?.id&&normalizeCsvKey(s.student_name)===normalizeCsvKey(v(ix.name))&&(!v(ix.roll)||normalizeCsvKey(s.roll_no||'')===normalizeCsvKey(v(ix.roll))));
        const nums=[Number(v(ix.school)),Number(v(ix.tuition)),Number(v(ix.vehicle)),ix.paid<0?0:Number(v(ix.paid)||0)];
        if(!cls||candidates.length!==1||nums.some(n=>!Number.isFinite(n)||n<0)||seenStudents.has(candidates[0]?.id||'')){issues++;continue;}
        seenStudents.add(candidates[0].id);
        preview.push({student_id:candidates[0].id,student_name:candidates[0].student_name,school_fee:nums[0],tuition_fee:nums[1],vehicle_fee:nums[2],opening_paid:nums[3]});
      }
      if(!preview.length) throw new Error('No unambiguous valid fee rows matched existing students. Check names, classes and roll numbers.');
      setFeeImportPreview(preview);setFeeImportIssues(issues);setFeeImportName(file.name);
      setMessage('Fee CSV checked. Review the matched students before importing.');
    } catch(err) { setError(err instanceof Error?err.message:'Could not read fee CSV.'); }
    finally { input.value=''; }
  }

  async function confirmFeeImport() {
    if(!supabase||!feeImportPreview.length)return;
    setFeeImportBusy(true);setError('');setMessage('');
    const {data:existing,error:readError}=await supabase.from('fee_assessments').select('student_id').eq('academic_year',feeForm.academic_year.trim()).eq('fee_period',feeForm.fee_period.trim());
    if(readError||!existing){setError('Could not check existing billing periods. Nothing imported.');setFeeImportBusy(false);return;}
    const seen=new Set(existing.map(x=>x.student_id));
    const rows=feeImportPreview.filter(x=>!seen.has(x.student_id)).map(x=>({student_id:x.student_id,academic_year:feeForm.academic_year.trim(),fee_period:feeForm.fee_period.trim(),school_fee:x.school_fee,tuition_fee:x.tuition_fee,vehicle_fee:x.vehicle_fee,opening_paid:x.opening_paid,due_date:feeForm.due_date||null,notes:'Imported from Admin-reviewed fee CSV'}));
    const skipped=feeImportPreview.length-rows.length;let inserted=0;let failed=false;
    for(let offset=0;offset<rows.length;offset+=50){const {error:insertError}=await supabase.from('fee_assessments').insert(rows.slice(offset,offset+50));if(insertError){setError('Fee import stopped after '+inserted+' records. Existing entries were preserved; retry after checking the saved period.');failed=true;break;}inserted+=Math.min(50,rows.length-offset);}
    if(!failed){setMessage('Fee import complete: '+inserted+' added, '+skipped+' existing period records skipped, '+feeImportIssues+' invalid or unmatched rows skipped.');setFeeImportPreview([]);setFeeImportName('');setFeeImportIssues(0);await loadData();}
    setFeeImportBusy(false);
  }

  async function saveFeeAssessment(event: FormEvent) {
    event.preventDefault(); if (!supabase || !feeForm.student_id) return;
    const amounts = [feeForm.school_fee, feeForm.tuition_fee, feeForm.vehicle_fee, feeForm.opening_paid].map(Number);
    if (amounts.some((value) => !Number.isFinite(value) || value < 0)) { setError('Fee amounts must be valid non-negative numbers.'); return; }
    setBusy(true); setError(''); setMessage('');
    const payload = { student_id: feeForm.student_id, academic_year: feeForm.academic_year.trim(), fee_period: feeForm.fee_period.trim(), school_fee: amounts[0], tuition_fee: amounts[1], vehicle_fee: amounts[2], opening_paid: amounts[3], due_date: feeForm.due_date || null, notes: feeForm.notes.trim() || null };
    const { data: existing, error: findError } = await supabase.from('fee_assessments').select('id').eq('student_id', payload.student_id).eq('academic_year', payload.academic_year).eq('fee_period', payload.fee_period).maybeSingle();
    if (findError) { setError('Could not check the existing fee period. No changes were saved.'); setBusy(false); return; }
    const result = existing ? await supabase.from('fee_assessments').update(payload).eq('id', existing.id) : await supabase.from('fee_assessments').insert(payload);
    if (result.error) setError('Fee assessment could not be saved. Check the student, period and Admin permissions.');
    else { setMessage(existing ? 'Fee assessment updated.' : 'Fee assessment created.'); setFeeForm((prev) => ({ ...prev, student_id: '', school_fee: '0', tuition_fee: '0', vehicle_fee: '0', opening_paid: '0', due_date: '', notes: '' })); await loadData(); }
    setBusy(false);
  }

  async function saveFeePayment(event: FormEvent) {
    event.preventDefault(); if(!supabase||!paymentForm.fee_assessment_id||!adminUserId)return;
    const amount=Number(paymentForm.amount); if(!Number.isFinite(amount)||amount<=0){setError('Enter a valid payment amount greater than zero.');return;}
    const assessment=feeAssessments.find(x=>x.id===paymentForm.fee_assessment_id);if(!assessment){setError('Select a valid fee assessment.');return;}
    const paid=Number(assessment.opening_paid)+feePayments.filter(p=>p.fee_assessment_id===assessment.id&&p.status==='verified').reduce((sum,p)=>sum+Number(p.amount),0);
    const total=Number(assessment.school_fee)+Number(assessment.tuition_fee)+Number(assessment.vehicle_fee);const due=Math.max(0,total-paid);
    if(amount>due){setError('Payment cannot exceed the current outstanding balance of ₹'+due.toLocaleString('en-IN')+'.');return;}
    setBusy(true);setError('');setMessage('');
    const {error:insertError}=await supabase.from('fee_payments').insert({fee_assessment_id:assessment.id,student_id:assessment.student_id,amount,payment_method:paymentForm.payment_method,transaction_reference:paymentForm.transaction_reference.trim()||null,status:'verified',verified_by:adminUserId,verified_at:new Date().toISOString(),admin_note:paymentForm.admin_note.trim()||'Recorded by Admin'});
    if(insertError)setError('Payment could not be recorded. Check Admin permission and the selected assessment.');else{setMessage('Verified payment recorded.');setPaymentForm({fee_assessment_id:'',amount:'',payment_method:'Cash',transaction_reference:'',admin_note:''});await loadData();}
    setBusy(false);
  }

  async function createOnlineExam(event:FormEvent) {
    event.preventDefault(); if(!supabase||!adminUserId||!examForm.class_id)return;
    const duration=Number(examForm.duration_minutes),marks=Number(examForm.total_marks),start=new Date(examForm.start_at),end=new Date(examForm.end_at);
    if(!examForm.title.trim()||!Number.isInteger(duration)||duration<1||!Number.isFinite(marks)||marks<=0||!examForm.subject.trim()||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start){setError('Check exam title, duration, marks and start/end time.');return;}
    setBusy(true);setError('');setMessage('');
    const {error:insertError}=await supabase.from('online_exams').insert({class_id:examForm.class_id,subject:examForm.subject.trim(),title:examForm.title.trim(),instructions:examForm.instructions.trim()||null,duration_minutes:duration,start_at:start.toISOString(),end_at:end.toISOString(),total_marks:marks,negative_marking:0,status:'draft',results_published:false,created_by:adminUserId});
    if(insertError)setError('Exam draft could not be created. Check the class and Admin access.');else{setMessage('Exam draft created. Add questions before publishing.');setExamForm({...examForm,title:'',instructions:''});await loadData();}
    setBusy(false);
  }
  async function addExamQuestion(event:FormEvent) {
    event.preventDefault();if(!supabase||!questionForm.exam_id)return;
    const exam=onlineExams.find(x=>x.id===questionForm.exam_id);if(!exam||exam.status!=='draft'){setError('Choose an exam draft.');return;}
    const marks=Number(questionForm.marks);if(!questionForm.question_text.trim()||[questionForm.option_a,questionForm.option_b,questionForm.option_c,questionForm.option_d].some(x=>!x.trim())||!Number.isFinite(marks)||marks<=0){setError('Complete the question, four options and valid marks.');return;}
    const used=examQuestions.filter(q=>q.exam_id===exam.id).reduce((sum,q)=>sum+Number(q.marks),0);if(used+marks>Number(exam.total_marks)){setError('Question marks exceed the exam total. Remaining: '+(Number(exam.total_marks)-used));return;}
    setBusy(true);setError('');setMessage('');
    const options=[{key:'A',text:questionForm.option_a.trim()},{key:'B',text:questionForm.option_b.trim()},{key:'C',text:questionForm.option_c.trim()},{key:'D',text:questionForm.option_d.trim()}];
    const {data,error:questionError}=await supabase.from('exam_questions').insert({exam_id:exam.id,question_order:used===0?1:examQuestions.filter(q=>q.exam_id===exam.id).length+1,question_type:'mcq',question_text:questionForm.question_text.trim(),options,marks}).select('id').single();
    if(questionError||!data){setError('Question could not be saved.');setBusy(false);return;}
    const {error:keyError}=await supabase.from('exam_answer_keys').insert({question_id:data.id,correct_answer:questionForm.correct_answer,explanation:questionForm.explanation.trim()||null});
    if(keyError){setError('Question saved but answer key failed. Keep this exam draft unpublished and contact Admin support.');}else{setMessage('Question and answer key saved.');setQuestionForm({...questionForm,question_text:'',option_a:'',option_b:'',option_c:'',option_d:'',explanation:''});await loadData();}
    setBusy(false);
  }
  async function publishOnlineExam(exam:OnlineExam) {
    if(!supabase||!adminUserId||!window.confirm('Publish this exam for its assigned class? Students will be able to see it during the scheduled time.'))return;
    const qs=examQuestions.filter(q=>q.exam_id===exam.id);const marks=qs.reduce((sum,q)=>sum+Number(q.marks),0);
    if(!qs.length||Math.abs(marks-Number(exam.total_marks))>0.001){setError('Cannot publish: add questions so their marks equal the exam total ('+exam.total_marks+').');return;}
    setBusy(true);setError('');const {error:updateError}=await supabase.from('online_exams').update({status:'published',approved_by:adminUserId}).eq('id',exam.id).eq('status','draft');
    if(updateError)setError('Exam could not be published.');else{setMessage('Exam published for '+(groups.find(g=>g.id===exam.class_id)?.name_en||'selected class')+'.');await loadData();}
    setBusy(false);
  }

  async function reviewLearningNote(note: LearningNote, decision: 'published' | 'rejected') {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    setBusy(true); setError(''); setMessage('');
    const patch = decision === 'published' ? { status: 'published', approved_by: user.id, published_at: new Date().toISOString() } : { status: 'rejected', approved_by: user.id };
    const { error: updateError } = await supabase.from('daily_notes').update(patch).eq('id', note.id).eq('status','pending_review');
    if (updateError) setError('Learning note review failed. Please retry.');
    else { setMessage(decision === 'published' ? 'Learning note published for its class.' : 'Learning note rejected.'); await loadData(); }
    setBusy(false);
  }

  async function publishNotice(event: FormEvent) {
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

  const nav: { id: Tab; icon: typeof LayoutDashboard }[] = [{id:'dashboard',icon:LayoutDashboard},{id:'students',icon:GraduationCap},{id:'teachers',icon:Users},{id:'learning',icon:BookOpen},{id:'fees',icon:Activity},{id:'exams',icon:GraduationCap},{id:'admissions',icon:BookOpen},{id:'notices',icon:Megaphone},{id:'settings',icon:ShieldCheck}];
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
      {tab==='fees'&&<section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Student Fee Assessments</h3><p>Create or update a fee amount for one student and one billing period. No payment is collected here.</p></div><span className="admin-count-pill">{feeAssessments.length} records</span></div><div className="student-import-panel"><div><b>Import reviewed fee CSV</b><p>Match rows to existing student records using name, class and optional roll number. Required columns: student_name, class_name, school_fee, tuition_fee, vehicle_fee. Optional: total_paid or opening_paid.</p></div><input ref={feeImportRef} type="file" accept=".csv,text/csv" hidden onChange={prepareFeeCsv}/><button type="button" className="admin-secondary" onClick={()=>feeImportRef.current?.click()} disabled={feeImportBusy}>Choose Fee CSV</button>{feeImportName&&<small>Selected: {feeImportName}</small>}{feeImportPreview.length>0&&<div className="student-import-review"><strong>{feeImportPreview.length} matched fee rows ready</strong><span>{feeImportIssues} unmatched or invalid rows will be skipped. Target period: {feeForm.fee_period} · {feeForm.academic_year}</span><small>Preview: {feeImportPreview.slice(0,5).map(x=>x.student_name).join(', ')}</small><div className="admin-form-actions"><button type="button" className="admin-secondary" onClick={()=>{setFeeImportPreview([]);setFeeImportName('');setFeeImportIssues(0)}} disabled={feeImportBusy}>Cancel</button><button type="button" className="admin-primary" onClick={confirmFeeImport} disabled={feeImportBusy}>{feeImportBusy?'Importing…':'Confirm Fee Import'}</button></div></div>}<small>CSV is read in this browser. It is not committed to GitHub. Import only after the school verifies the figures and billing period.</small></div>
      <form className="admin-student-form" onSubmit={saveFeeAssessment}><label>Student<select required value={feeForm.student_id} onChange={e=>setFeeForm({...feeForm,student_id:e.target.value})}><option value="">Select student</option>{students.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.student_name} · {groups.find(g=>g.id===s.class_id)?.name_en||'Class'} · {s.roll_no||'No roll'}</option>)}</select></label><label>Academic Year<input required value={feeForm.academic_year} onChange={e=>setFeeForm({...feeForm,academic_year:e.target.value})} placeholder="2026-27"/></label><label>Fee Period<input required type="month" value={feeForm.fee_period} onChange={e=>setFeeForm({...feeForm,fee_period:e.target.value})}/></label><label>School Fee (₹)<input required type="number" min="0" step="0.01" value={feeForm.school_fee} onChange={e=>setFeeForm({...feeForm,school_fee:e.target.value})}/></label><label>Tuition Fee (₹)<input required type="number" min="0" step="0.01" value={feeForm.tuition_fee} onChange={e=>setFeeForm({...feeForm,tuition_fee:e.target.value})}/></label><label>Vehicle Fee (₹)<input required type="number" min="0" step="0.01" value={feeForm.vehicle_fee} onChange={e=>setFeeForm({...feeForm,vehicle_fee:e.target.value})}/></label><label>Opening Paid (₹)<input required type="number" min="0" step="0.01" value={feeForm.opening_paid} onChange={e=>setFeeForm({...feeForm,opening_paid:e.target.value})}/></label><label>Due Date<input type="date" value={feeForm.due_date} onChange={e=>setFeeForm({...feeForm,due_date:e.target.value})}/></label><label>Notes<input value={feeForm.notes} onChange={e=>setFeeForm({...feeForm,notes:e.target.value})}/></label><div className="admin-form-actions"><button className="admin-primary" disabled={busy||!students.some(s=>s.active)}>{busy?'Saving…':'Save Fee Assessment'}</button></div></form><div className="admin-table-wrap"><table><thead><tr><th>Student</th><th>Period</th><th>School</th><th>Tuition</th><th>Vehicle</th><th>Total</th><th>Paid</th><th>Due</th></tr></thead><tbody>{feeAssessments.map(f=>{const total=Number(f.school_fee)+Number(f.tuition_fee)+Number(f.vehicle_fee);const paid=Number(f.opening_paid)+feePayments.filter(p=>p.fee_assessment_id===f.id&&p.status==='verified').reduce((sum,p)=>sum+Number(p.amount),0);const due=Math.max(0,total-paid);return <tr key={f.id}><td>{f.students?.student_name||'Student'}<small>{f.students?.roll_no||''}</small></td><td>{f.fee_period}</td><td>₹{Number(f.school_fee).toLocaleString('en-IN')}</td><td>₹{Number(f.tuition_fee).toLocaleString('en-IN')}</td><td>₹{Number(f.vehicle_fee).toLocaleString('en-IN')}</td><td>₹{total.toLocaleString('en-IN')}</td><td>₹{paid.toLocaleString('en-IN')}</td><td>₹{due.toLocaleString('en-IN')}</td></tr>})}</tbody></table>{feeAssessments.length===0&&<div className="admin-empty">No fee assessments yet. Select a student and create the first billing period.</div>}</div><div className="admin-card-heading"><div><h3>Record verified payment</h3><p>For payments the school has already received through cash, UPI, bank or cheque. This does not collect online payments.</p></div><span className="admin-count-pill">{feePayments.filter(p=>p.status==='verified').length} verified</span></div><form className="admin-student-form" onSubmit={saveFeePayment}><label>Fee Assessment<select required value={paymentForm.fee_assessment_id} onChange={e=>setPaymentForm({...paymentForm,fee_assessment_id:e.target.value})}><option value="">Select student / billing period</option>{feeAssessments.map(a=>{const paid=Number(a.opening_paid)+feePayments.filter(p=>p.fee_assessment_id===a.id&&p.status==='verified').reduce((sum,p)=>sum+Number(p.amount),0);const total=Number(a.school_fee)+Number(a.tuition_fee)+Number(a.vehicle_fee);return <option key={a.id} value={a.id}>{a.students?.student_name||'Student'} · {a.fee_period} · Due ₹{Math.max(0,total-paid).toLocaleString('en-IN')}</option>})}</select></label><label>Amount received (₹)<input required type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})}/></label><label>Payment Method<select value={paymentForm.payment_method} onChange={e=>setPaymentForm({...paymentForm,payment_method:e.target.value})}><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option><option>Other</option></select></label><label>Transaction / Receipt Reference<input value={paymentForm.transaction_reference} onChange={e=>setPaymentForm({...paymentForm,transaction_reference:e.target.value})}/></label><label>Admin Note<input value={paymentForm.admin_note} onChange={e=>setPaymentForm({...paymentForm,admin_note:e.target.value})}/></label><div className="admin-form-actions"><button className="admin-primary" disabled={busy||feeAssessments.length===0}>{busy?'Saving…':'Record Verified Payment'}</button></div></form><div className="admin-table-wrap"><table><thead><tr><th>Date</th><th>Assessment</th><th>Amount</th><th>Method</th><th>Reference</th><th>Status</th></tr></thead><tbody>{feePayments.map(p=><tr key={p.id}><td>{new Date(p.submitted_at).toLocaleDateString('en-IN')}</td><td>{feeAssessments.find(a=>a.id===p.fee_assessment_id)?.students?.student_name||'Student'} · {feeAssessments.find(a=>a.id===p.fee_assessment_id)?.fee_period||''}</td><td>₹{Number(p.amount).toLocaleString('en-IN')}</td><td>{p.payment_method}</td><td>{p.transaction_reference||p.id.slice(0,8)}</td><td>{p.status}</td></tr>)}</tbody></table>{feePayments.length===0&&<div className="admin-empty">No payment entries yet.</div>}</div><p className="admin-muted-note">Admin-only verified payment records. Razorpay / UPI checkout, downloadable receipts, automated monthly increases and due notifications still require separate implementation and an authorized school adult’s gateway setup.</p></section>}
      {tab==='exams'&&<section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Online Examination Manager</h3><p>Create class-wise MCQ exam drafts, add four-option questions and publish after the marks total is verified.</p></div><span className="admin-count-pill">{onlineExams.length} exams</span></div><form className="admin-student-form" onSubmit={createOnlineExam}><label>Class<select required value={examForm.class_id} onChange={e=>setExamForm({...examForm,class_id:e.target.value})}><option value="">Select class</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name_en}</option>)}</select></label><label>Subject<input required value={examForm.subject} onChange={e=>setExamForm({...examForm,subject:e.target.value})}/></label><label>Exam Title<input required value={examForm.title} onChange={e=>setExamForm({...examForm,title:e.target.value})}/></label><label>Duration (minutes)<input required type="number" min="1" value={examForm.duration_minutes} onChange={e=>setExamForm({...examForm,duration_minutes:e.target.value})}/></label><label>Total Marks<input required type="number" min="1" step="0.5" value={examForm.total_marks} onChange={e=>setExamForm({...examForm,total_marks:e.target.value})}/></label><label>Start Time<input required type="datetime-local" value={examForm.start_at} onChange={e=>setExamForm({...examForm,start_at:e.target.value})}/></label><label>End Time<input required type="datetime-local" value={examForm.end_at} onChange={e=>setExamForm({...examForm,end_at:e.target.value})}/></label><label>Instructions<input value={examForm.instructions} onChange={e=>setExamForm({...examForm,instructions:e.target.value})}/></label><div className="admin-form-actions"><button className="admin-primary" disabled={busy}>{busy?'Saving…':'Create Exam Draft'}</button></div></form><div className="admin-card-heading"><div><h3>Add MCQ question</h3><p>Each question includes four options, the answer key and an optional explanation.</p></div></div><form className="admin-student-form" onSubmit={addExamQuestion}><label>Exam Draft<select required value={questionForm.exam_id} onChange={e=>setQuestionForm({...questionForm,exam_id:e.target.value})}><option value="">Select draft</option>{onlineExams.filter(e=>e.status==='draft').map(e=><option key={e.id} value={e.id}>{e.title} · {groups.find(g=>g.id===e.class_id)?.name_en||'Class'}</option>)}</select></label><label>Question<input required value={questionForm.question_text} onChange={e=>setQuestionForm({...questionForm,question_text:e.target.value})}/></label><label>Option A<input required value={questionForm.option_a} onChange={e=>setQuestionForm({...questionForm,option_a:e.target.value})}/></label><label>Option B<input required value={questionForm.option_b} onChange={e=>setQuestionForm({...questionForm,option_b:e.target.value})}/></label><label>Option C<input required value={questionForm.option_c} onChange={e=>setQuestionForm({...questionForm,option_c:e.target.value})}/></label><label>Option D<input required value={questionForm.option_d} onChange={e=>setQuestionForm({...questionForm,option_d:e.target.value})}/></label><label>Correct Option<select value={questionForm.correct_answer} onChange={e=>setQuestionForm({...questionForm,correct_answer:e.target.value})}><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></label><label>Marks<input required type="number" min="0.5" step="0.5" value={questionForm.marks} onChange={e=>setQuestionForm({...questionForm,marks:e.target.value})}/></label><label>Explanation (optional)<input value={questionForm.explanation} onChange={e=>setQuestionForm({...questionForm,explanation:e.target.value})}/></label><div className="admin-form-actions"><button className="admin-primary" disabled={busy||!onlineExams.some(e=>e.status==='draft')}>{busy?'Saving…':'Add Question & Answer Key'}</button></div></form><div className="admin-table-wrap"><table><thead><tr><th>Exam</th><th>Class</th><th>Subject</th><th>Questions</th><th>Marks</th><th>Schedule</th><th>Status</th><th>Action</th></tr></thead><tbody>{onlineExams.map(exam=>{const qs=examQuestions.filter(q=>q.exam_id===exam.id);const sum=qs.reduce((n,q)=>n+Number(q.marks),0);return <tr key={exam.id}><td>{exam.title}</td><td>{groups.find(g=>g.id===exam.class_id)?.name_en||'Class'}</td><td>{exam.subject}</td><td>{qs.length}</td><td>{sum}/{exam.total_marks}</td><td>{new Date(exam.start_at).toLocaleString('en-IN')}</td><td>{exam.status}</td><td>{exam.status==='draft'&&<button type="button" className="admin-primary compact" disabled={busy||!qs.length||Math.abs(sum-Number(exam.total_marks))>0.001} onClick={()=>publishOnlineExam(exam)}>Publish</button>}</td></tr>})}</tbody></table>{onlineExams.length===0&&<div className="admin-empty">No exams created yet.</div>}</div><p className="admin-muted-note">This is the Admin MCQ authoring and publishing foundation. Student exam taking, manual marking for written questions, AI question generation and result/marksheet screens remain separate stages. Keep exams unpublished until reviewed by the school.</p></section>}
      {tab==='admissions'&&<section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Admission Enquiries</h3><p>Recent public website enquiries</p></div></div><div className="admin-table-wrap"><table><thead><tr><th>Student</th><th>Parent</th><th>Mobile</th><th>Class</th><th>Status</th></tr></thead><tbody>{enquiries.map(e=><tr key={e.id}><td>{e.student_name}</td><td>{e.parent_name}</td><td>{e.mobile_number}</td><td>{e.class_applied}</td><td>{e.status}</td></tr>)}</tbody></table>{enquiries.length===0&&<div className="admin-empty">No admission enquiries received yet.</div>}</div></section>}
      {tab==='notices'&&<section className="admin-panel-card"><div className="admin-card-heading"><div><h3>Publish a School Notice</h3><p>Notices are stored in the campus database.</p></div></div><form className="admin-notice-form" onSubmit={publishNotice}><label>Notice Title<input required value={noticeForm.title} onChange={e=>setNoticeForm({...noticeForm,title:e.target.value})}/></label><label>Message<textarea required rows={5} value={noticeForm.body} onChange={e=>setNoticeForm({...noticeForm,body:e.target.value})}/></label><label>Audience<select value={noticeForm.audience} onChange={e=>setNoticeForm({...noticeForm,audience:e.target.value})}><option value="all">Students and Teachers</option><option value="students">Students only</option><option value="teachers">Teachers only</option><option value="public">Public</option></select></label><button className="admin-primary" disabled={busy}>{busy?'Publishing…':'Publish Notice'}</button></form></section>}
      {tab==='settings'&&<section className="admin-panel-card"><div className="admin-card-heading"><div><h3>School Settings</h3><p>Protected configuration areas</p></div></div><div className="admin-settings-list"><div><ShieldCheck/><span><b>Admin security</b><small>Role is verified against the protected user_profiles table.</small></span><span className="status-active">Protected</span></div><div><School/><span><b>School identity</b><small>Logo, leadership, contact details and homepage content.</small></span><span className="status-inactive">Next build stage</span></div><div><Bell/><span><b>AI, payment and push credentials</b><small>Must be stored as server-side secrets, never in browser storage.</small></span><span className="status-inactive">Not configured</span></div></div></section>}
      <footer className="admin-footer">SSVM SANKHULA Digital Campus · Secure Administration</footer>
    </main>
  </div>;
}