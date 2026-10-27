-- =====================================================================
-- Password hardening — STEP A (ไม่ทำให้ระบบเดิมพัง รันก่อน deploy โค้ดใหม่ได้)
-- รันใน Supabase Dashboard → SQL Editor ทั้งไฟล์ในครั้งเดียว
--
-- สิ่งที่ทำ:
--   1. สำรองรหัสผ่านเดิมไว้ในตารางที่ไม่มีใครอ่านได้นอกจาก postgres (ไว้ย้อนกลับ)
--   2. เพิ่มคอลัมน์ password_hash แล้วแปลงรหัสผ่านเดิมเป็น hash (bcrypt)
--   3. Trigger: ทุกครั้งที่มีการตั้ง/เปลี่ยน password จะคำนวณ hash ให้อัตโนมัติ
--      (STEP A ยังเก็บ password เดิมไว้ เพื่อให้หน้าเว็บเวอร์ชันเก่ายังล็อกอินได้)
--   4. ฟังก์ชัน login_lookup(): ตรวจรหัสผ่านนักเรียน/ผู้ปกครองฝั่ง server
--      และคืนเฉพาะข้อมูลที่จำเป็น (ไม่คืนรหัสผ่าน)
-- =====================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- 1) สำรองรหัสผ่านเดิม (ลบตารางนี้ทิ้งได้หลังจากทุกอย่างใช้งานได้แล้ว)
create table if not exists public.users_password_backup as
  select id, password, now() as backed_up_at from public.users where password is not null;
alter table public.users_password_backup enable row level security;  -- ไม่มี policy = anon/authenticated อ่านไม่ได้
revoke all on public.users_password_backup from anon, authenticated;

-- 2) คอลัมน์ hash + แปลงรหัสผ่านเดิม
alter table public.users add column if not exists password_hash text;

update public.users
   set password_hash = extensions.crypt(password, extensions.gen_salt('bf'))
 where password is not null and password <> '';

-- 3) Trigger คำนวณ hash ทุกครั้งที่ตั้ง/เปลี่ยนรหัสผ่าน
create or replace function public.fn_hash_user_password()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.password is not null and new.password <> '' then
    new.password_hash := extensions.crypt(new.password, extensions.gen_salt('bf'));
  end if;
  -- STEP A: ยังเก็บ password เดิมไว้ (STEP B จะเปลี่ยนให้ล้างทิ้งเสมอ)
  return new;
end;
$$;

drop trigger if exists trg_hash_user_password on public.users;
create trigger trg_hash_user_password
  before insert or update of password on public.users
  for each row execute function public.fn_hash_user_password();

-- 4) ล็อกอินฝั่ง server
--    - นักเรียน/ผู้ปกครอง: ตรวจรหัสผ่านกับ hash แล้วคืนข้อมูล session (ไม่มีรหัสผ่าน)
--    - แอดมิน/ครู: คืนเฉพาะ email ให้หน้าเว็บไปล็อกอินผ่าน Supabase Auth ต่อ (Auth เป็นคนตรวจรหัสผ่าน)
--    - ไม่เจอ / รหัสผิด: คืน null (ไม่บอกว่าผิดที่ username หรือ password)
create or replace function public.login_lookup(p_username text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u public.users%rowtype;
begin
  select * into u from public.users where username = p_username limit 1;
  if not found then
    return null;
  end if;

  if u.role in ('student', 'parent') then
    if u.password_hash is null or u.password_hash <> extensions.crypt(p_password, u.password_hash) then
      return null;
    end if;
    return json_build_object(
      'id', u.id,
      'role', u.role,
      'name', u.name,
      'username', u.username,
      'grade', u.grade
    );
  end if;

  return json_build_object('role', u.role, 'email', u.email);
end;
$$;

revoke all on function public.login_lookup(text, text) from public;
grant execute on function public.login_lookup(text, text) to anon, authenticated;

commit;

-- ---------------------------------------------------------------------
-- ตรวจผลหลังรัน (ควรได้ตัวเลขเท่ากันทั้ง 2 ช่อง)
-- select count(*) filter (where password is not null and password <> '') as plain,
--        count(*) filter (where password_hash is not null)                as hashed
--   from public.users;
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- ROLLBACK STEP A (ถ้าต้องการย้อนกลับ)
-- begin;
--   drop trigger if exists trg_hash_user_password on public.users;
--   drop function if exists public.fn_hash_user_password();
--   drop function if exists public.login_lookup(text, text);
--   alter table public.users drop column if exists password_hash;
-- commit;
-- ---------------------------------------------------------------------
