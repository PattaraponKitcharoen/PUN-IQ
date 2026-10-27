-- =====================================================================
-- Password hardening — STEP B (รันหลังจาก deploy โค้ดใหม่ และทดสอบล็อกอินครบทุกบทบาทแล้ว)
-- ต้องรัน STEP A มาก่อน
--
-- สิ่งที่ทำ:
--   1. Trigger เวอร์ชันสุดท้าย: hash แล้วล้างรหัสผ่านตัวจริงทิ้งเสมอ (ไม่เก็บ plaintext อีกต่อไป)
--   2. ล้าง plaintext ที่มีอยู่ทั้งหมด
--   3. ห้าม anon / authenticated อ่านคอลัมน์ password และ password_hash
--      (คอลัมน์อื่นอ่านได้เหมือนเดิม — ส่วนนี้ยังไม่ได้ปิดการอ่านตาราง users ทั้งตาราง)
-- =====================================================================

begin;

-- 1) Trigger เวอร์ชันสุดท้าย
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
  new.password := null;  -- ไม่เก็บรหัสผ่านตัวจริง
  return new;
end;
$$;

-- 2) ล้าง plaintext (hash ทำไว้แล้วใน STEP A; trigger จะ hash ซ้ำให้กับแถวที่ยังไม่มี hash)
update public.users set password = password where password is not null and password <> '' and password_hash is null;
update public.users set password = null where password is not null;

-- 3) ซ่อนคอลัมน์รหัสผ่านจาก anon / authenticated
--    (ให้สิทธิ์อ่านทุกคอลัมน์ยกเว้น password, password_hash)
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'users'
     and column_name not in ('password', 'password_hash');

  execute 'revoke select on public.users from anon, authenticated';
  execute format('grant select (%s) on public.users to anon, authenticated', cols);
end;
$$;

commit;

-- ---------------------------------------------------------------------
-- ⚠️ หมายเหตุสำคัญ: ถ้าในอนาคตเพิ่มคอลัมน์ใหม่ในตาราง users ต้องให้สิทธิ์อ่านเพิ่มเอง เช่น
--   grant select (new_column) on public.users to anon, authenticated;
-- ไม่งั้นหน้าเว็บจะอ่านคอลัมน์นั้นไม่ได้
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- ตรวจผลหลังรัน
-- select count(*) filter (where password is not null) as plain_left,     -- ควรเป็น 0
--        count(*) filter (where password_hash is not null) as hashed
--   from public.users;
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- ลบตารางสำรองรหัสผ่านเดิม (ทำหลังจากใช้งานจริงไปสักพักและมั่นใจแล้วเท่านั้น)
-- drop table public.users_password_backup;
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- ROLLBACK STEP B (คืนสิทธิ์อ่านทั้งตาราง + คืนรหัสผ่านจากตารางสำรอง)
-- begin;
--   grant select on public.users to anon, authenticated;
--   -- trigger กลับเป็นเวอร์ชัน STEP A (เก็บ password ไว้) — รันส่วน create or replace function จากไฟล์ STEP A
--   update public.users u set password = b.password
--     from public.users_password_backup b where b.id = u.id and u.password is null;
-- commit;
-- ---------------------------------------------------------------------
