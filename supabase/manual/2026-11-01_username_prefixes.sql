-- =====================================================================
-- ตารางรูปแบบรหัส (Username) ที่แอดมินเพิ่ม/ลบเองได้จากหน้าเว็บ
-- รันใน Supabase Dashboard → SQL Editor ทั้งไฟล์ในครั้งเดียว
--
-- เดิม: รูปแบบรหัสถูกเขียนตายตัวในโค้ด (นักเรียน SPIQH/SPIQP/B, ครู K/P)
-- ใหม่: เก็บในตารางนี้ แอดมินกด "+ เพิ่ม" ในหน้าต่างเพิ่มนักเรียน/ครูได้เลย เช่น SPIQSXXX
--       (ถ้ายังไม่ได้รันไฟล์นี้ หน้าเว็บจะใช้ชุดเดิมที่เขียนไว้ในโค้ดแทน)
-- สิทธิ์: แอดมินเท่านั้นที่อ่าน/เพิ่ม/ลบได้ (หน้าต่างเพิ่มผู้ใช้เป็นของแอดมิน)
-- =====================================================================

begin;

create table if not exists public.username_prefixes (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('student', 'tutor')),
  prefix text not null check (prefix ~ '^[A-Z]{1,10}$'),   -- ตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ 1-10 ตัว
  digits int not null check (digits between 1 and 5),       -- จำนวนหลักของตัวเลข
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  unique (role, prefix)
);

alter table public.username_prefixes enable row level security;

drop policy if exists "username_prefixes_admin_all" on public.username_prefixes;
create policy "username_prefixes_admin_all" on public.username_prefixes
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

revoke all on public.username_prefixes from anon;
grant select, insert, update, delete on public.username_prefixes to authenticated;

-- ชุดเดิมที่ใช้อยู่
insert into public.username_prefixes (role, prefix, digits, sort_order) values
  ('student', 'SPIQH', 3, 10),
  ('student', 'SPIQP', 3, 20),
  ('student', 'B',     2, 30),
  ('tutor',   'K',     2, 10),
  ('tutor',   'P',     2, 20)
on conflict (role, prefix) do nothing;

commit;

-- ---------------------------------------------------------------------
-- ตรวจผล
-- select role, prefix, digits, sort_order from public.username_prefixes order by role, sort_order;
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- ROLLBACK (หน้าเว็บจะกลับไปใช้ชุดที่เขียนไว้ในโค้ดเอง)
-- drop table if exists public.username_prefixes;
-- ---------------------------------------------------------------------
