# SSVM SANKHULA Digital Campus

Mobile-first PWA foundation for Saraswati Shishu Vidya Mandir, Sankhula, Bhadrak, Odisha.

## Implemented in this foundation
- Responsive bilingual Odia/English public homepage
- 13 class groups (Aruna, Udaya, Kiran, Classes 1–10)
- Published gallery and achievements read from Supabase
- Admission enquiry form writes to the existing admission_enquiries table
- PWA manifest, placeholder crest icon and service-worker shell caching
- Secure teacher phone/password login at `/teacher`, restricted to Admin-created teacher accounts
- Teacher daily-learning-note submission with Admin approval before publication
- Student access information page at `/student`; student sign-in remains disabled until verified OTP delivery is configured
- No demo student or teacher records

## Setup
Copy .env.example to .env.local, set the Supabase URL and publishable key, then run npm install and npm run dev. Run npm run build before deployment.

Never put service-role/secret keys, passwords, Razorpay credentials, AI keys or student personal data in frontend code or GitHub. These belong in protected server-side secrets and RLS-controlled workflows.

Capacity values shown on the homepage are planned targets, not verified enrolment statistics. Teacher authentication and daily-note review are implemented in the current build. Student OTP sign-in, complete student portal, fee and exam workflows, AI and payment integration still require implementation and live verification.


## Admin panel foundation

- Open the Admin route at `/admin`.
- The Admin screen displays a password-only login. Supabase Auth uses the official Admin email from `VITE_ADMIN_LOGIN_EMAIL` (configured in hosting settings) and verifies an active `user_profiles.role = 'admin'` record. The email is configuration, not a secret; no password is hard-coded in the frontend. There is no public Admin sign-up.
- The current Supabase project has no Admin profile provisioned yet. An authorized adult school/project administrator must create and verify the official Auth account privately, then run the reviewed `database/day5_first_admin_bootstrap.template.sql` in the Supabase SQL Editor after replacing its email placeholder. Never put an Auth password, service-role key, or Razorpay/AI secret in GitHub.
- Configure Netlify environment variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_ADMIN_LOGIN_EMAIL` for the frontend. The publishable key is intended for browser use; never use a Supabase secret/service-role key in the frontend.
- Netlify SPA redirects are defined in `public/_redirects`.

The Admin panel currently provides secure role-gated access, dashboard counts, student record creation/import, teacher provisioning, admission enquiry viewing, school notice publishing, a Learning Review queue, and a fee-assessment foundation. Admin can create or update a student's school, tuition and vehicle fees for a billing period, record opening paid amounts, set due dates, and review assessed balances. Payment receipts, online payments, automated monthly increases and due notifications are not implemented yet. Full site-content editing, exam controls, AI settings and protected secret management remain future implementation tasks.

## Student CSV import

- In `/admin` → Students, an authorized Admin can select a CSV, review valid rows, and confirm import. Duplicate checks run before insertion; invalid rows are skipped and reported.
- Required columns: `student_name`, `class_code` (or `class_name`). Optional profile columns: `roll_no`, `dob`, `father_name`, `mother_name`, `mobile_number`.
- Fee columns are deliberately not written by the profile importer. Import legacy balances only through the fee-ledger workflow after the school verifies the source figures and accounting period.
- Keep the school's original student register and generated CSV files private. Never commit student names, dates of birth, parent names, phone numbers, or fee balances to this public repository.