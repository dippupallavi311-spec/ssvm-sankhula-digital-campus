# SSVM SANKHULA Digital Campus

Mobile-first PWA foundation for Saraswati Shishu Vidya Mandir, Sankhula, Bhadrak, Odisha.

## Implemented in this foundation
- Responsive bilingual Odia/English public homepage
- 13 class groups (Aruna, Udaya, Kiran, Classes 1–10)
- Published gallery and achievements read from Supabase
- Admission enquiry form writes to the existing admission_enquiries table
- PWA manifest, placeholder crest icon and service-worker shell caching
- No demo student or teacher records

## Setup
Copy .env.example to .env.local, set the Supabase URL and publishable key, then run npm install and npm run dev. Run npm run build before deployment.

Never put service-role/secret keys, passwords, Razorpay credentials, AI keys or student personal data in frontend code or GitHub. These belong in protected server-side secrets and RLS-controlled workflows.

Capacity values shown on the homepage are planned targets, not verified enrolment statistics. Student/teacher authentication, Admin console, fees, exams, AI and payment integration are not implemented yet.
