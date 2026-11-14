import { Link, ShieldCheck, School } from 'lucide-react';
import './admin.css';
export default function StudentAccess(){
 return <div className="admin-login-wrap"><section className="admin-login-card"><div className="admin-brand-mark"><School size={28}/></div><span className="admin-eyebrow">SSVM SANKHULA · STUDENT ACCESS</span><h1>Student Login</h1><p>ଛାତ୍ରଛାତ୍ରୀଙ୍କ ବ୍ୟକ୍ତିଗତ ତଥ୍ୟ ସୁରକ୍ଷିତ ରଖିବା ପାଇଁ login କୁ verified mobile OTP ଦ୍ୱାରା ସକ୍ରିୟ କରାଯିବ।</p><div className="admin-alert error">Student login ଏଯାଏଁ ସକ୍ରିୟ ହୋଇନାହିଁ। School Admin ଙ୍କ ଦ୍ୱାରା verified mobile OTP service configure ହେବା ପରେ ମାତ୍ର login ଖୋଲିବ। DOB/name/phone ମାତ୍ର ଦେଇ account access ଦେବା ସୁରକ୍ଷିତ ନୁହେଁ।</div><div className="teacher-note-row"><ShieldCheck/><span>ଆପଣଙ୍କ student record ଏହି public page ରେ ଦେଖାଯାଏ ନାହିଁ।</span></div><a href="/" className="admin-back">← Back to school website</a></section></div>;
}
