-- =====================================================================
-- Phase 2 — STEP 3: ปิดการอ่านข้อมูลแบบ "ใครก็อ่านได้"
-- ⚠️ รันหลังจาก: (1) รัน STEP 1 แล้ว (2) deploy โค้ดใหม่แล้ว
--               (3) ทดสอบล็อกอิน + ใช้งานครบ 4 บทบาทบนเว็บจริงแล้วเท่านั้น
-- รันใน Supabase Dashboard → SQL Editor ทั้งไฟล์ในครั้งเดียว
--
-- หลังรัน:
--   - คนที่ไม่ได้ล็อกอิน (anon key) อ่าน users / teaching_logs / parent_children /
--     company_accounts / custom_courses / pricing_rates ไม่ได้อีก
--   - ครูเห็นเฉพาะนักเรียนในความดูแล / ในกลุ่ม / ที่เคยลงเวลาสอน
--   - นักเรียนเห็นเฉพาะของตัวเอง, ผู้ปกครองเห็นเฉพาะของลูก, แอดมินเห็นทั้งหมด (กฎเดิมที่ยังอยู่)
--   - ตารางที่ยังเปิดให้ "คนที่ล็อกอินแล้ว" อ่านได้ทั้งหมด: company_accounts, custom_courses,
--     pricing_rates (ข้อมูลบัญชีรับเงิน/คอร์ส/เรท ที่แสดงในบิลอยู่แล้ว)
-- =====================================================================

begin;

-- users
drop policy if exists "Allow Public Select on users" on public.users;
drop policy if exists "Allow public read for login" on public.users;
drop policy if exists "everyone_read_users" on public.users;

-- teaching_logs
drop policy if exists "Allow Public Select on teaching_logs" on public.teaching_logs;

-- parent_children
drop policy if exists "Allow Public Select on parent_children" on public.parent_children;
drop policy if exists "Allow public select for parents mapping" on public.parent_children;

-- company_accounts (คนที่ล็อกอินแล้วยังอ่านได้ผ่าน everyone_read_company_accounts)
drop policy if exists "Allow Public Select on company_accounts" on public.company_accounts;
drop policy if exists "accounts_select" on public.company_accounts;

-- custom_courses (คนที่ล็อกอินแล้วยังอ่านได้ผ่าน "Allow all users to read custom_courses")
drop policy if exists "Allow Public Select on custom_courses" on public.custom_courses;

-- pricing_rates (คนที่ล็อกอินแล้วยังอ่านได้ผ่าน everyone_read_pricing_rates)
drop policy if exists "rates_select" on public.pricing_rates;

commit;

-- ---------------------------------------------------------------------
-- ตรวจผลหลังรัน: ไม่ควรเหลือกฎ SELECT ที่เงื่อนไขเป็น true สำหรับ public/anon
-- select tablename, policyname, roles::text, qual from pg_policies
--  where schemaname = 'public' and cmd = 'SELECT' and qual = 'true'
--  order by tablename;
-- (ที่เหลือควรเป็น roles {authenticated} ของ company_accounts / custom_courses / pricing_rates)
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- ROLLBACK STEP 3 (สร้างกฎเดิมกลับคืนทุกตัว)
-- begin;
--   create policy "Allow Public Select on users" on public.users for select to public using (true);
--   create policy "Allow public read for login" on public.users for select to anon using (true);
--   create policy "everyone_read_users" on public.users for select to authenticated using (true);
--   create policy "Allow Public Select on teaching_logs" on public.teaching_logs for select to public using (true);
--   create policy "Allow Public Select on parent_children" on public.parent_children for select to public using (true);
--   create policy "Allow public select for parents mapping" on public.parent_children for select to public using (true);
--   create policy "Allow Public Select on company_accounts" on public.company_accounts for select to public using (true);
--   create policy "accounts_select" on public.company_accounts for select to public using (true);
--   create policy "Allow Public Select on custom_courses" on public.custom_courses for select to public using (true);
--   create policy "rates_select" on public.pricing_rates for select to public using (true);
-- commit;
-- ---------------------------------------------------------------------
