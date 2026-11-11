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


## Admin panel foundation

- Open the Admin route at `/admin`.
- Sign-in uses Supabase Auth email/password and then verifies that the signed-in user has an active `user_profiles.role = 'admin'` record. There is no public Admin sign-up and no password is hard-coded in the frontend.
- The current Supabase project has no Admin profile provisioned yet. Before login can work, create the Admin Auth user privately in Supabase Authentication, then add that user's Auth UUID to `public.user_profiles` with role `admin` using the Supabase SQL Editor. Never put an Auth password, service-role key, or Razorpay/AI secret in GitHub.
- Configure Netlify environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the frontend. The publishable key is intended for browser use; never use a Supabase secret/service-role key in the frontend.
- Netlify SPA redirects are defined in `public/_redirects`.

The Admin panel currently provides secure role-gated access, dashboard counts, student record creation, teacher profile listing, admission enquiry viewing, and school notice publishing. Additional editing, teacher provisioning, fee controls, exam controls, AI settings and protected secret management remain future implementation tasks.
