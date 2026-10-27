-- =====================================================================
-- Phase 2 — STEP 1: บัญชีล็อกอิน Supabase Auth ให้นักเรียน/ผู้ปกครอง + กฎอ่านข้อมูลตามบทบาท
-- รันใน Supabase Dashboard → SQL Editor ทั้งไฟล์ในครั้งเดียว
-- ไม่ทำให้ระบบเดิมพัง: หน้าเว็บเวอร์ชันปัจจุบันยังล็อกอินและใช้งานได้ตามปกติหลังรันไฟล์นี้
--
-- สิ่งที่ทำ:
--   1. login_email_for(id): อีเมลซ่อนของนักเรียน/ผู้ปกครอง เช่น <id>@student.puniq.invalid
--      (ไม่ใช่อีเมลจริง ไม่มีการส่งเมล ใช้แค่ให้ Supabase Auth รู้จักบัญชี)
--   2. Trigger ซิงก์บัญชีล็อกอินอัตโนมัติจากตาราง users (สร้าง / เปลี่ยนรหัส / ลบ)
--      → ฟอร์มแอดมินเดิมใช้ได้เหมือนเดิม ไม่ต้องแก้
--   3. สร้างบัญชีล็อกอินให้นักเรียน/ผู้ปกครองที่มีอยู่แล้ว (ใช้ hash รหัสผ่านเดิม รหัสผ่านไม่เปลี่ยน)
--   4. login_lookup คืน email ให้นักเรียน/ผู้ปกครองด้วย (ยังคืนข้อมูลแบบเดิมเพื่อให้เว็บเวอร์ชันเก่ายังใช้ได้)
--   5. กฎอ่านข้อมูลใหม่ตามบทบาท (เพิ่มอย่างเดียว ยังไม่ลบกฎเก่า — STEP 3 จะลบ)
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) อีเมลซ่อน
-- ---------------------------------------------------------------------
create or replace function public.login_email_for(p_user_id uuid)
returns text
language sql
immutable
as $$
  select p_user_id::text || '@student.puniq.invalid'
$$;

-- ---------------------------------------------------------------------
-- 2) Trigger ซิงก์บัญชีล็อกอิน (เฉพาะ role student / parent)
--    หมายเหตุ: ทำงานกับ UPDATE ทุกครั้ง (ไม่ใช้ "update of password_hash") เพราะฟอร์มแอดมิน
--    ส่งมาแค่คอลัมน์ password แล้ว trigger ของ phase 1 เป็นคนคำนวณ hash ให้
-- ---------------------------------------------------------------------
create or replace function public.fn_sync_login_account()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  if tg_op = 'DELETE' then
    if old.role in ('student', 'parent') then
      -- ลบเฉพาะบัญชีที่เป็นอีเมลซ่อนของคนนี้เท่านั้น (ไม่แตะบัญชีครู/แอดมิน)
      delete from auth.users where id = old.id and email = public.login_email_for(old.id);
    end if;
    return old;
  end if;

  if new.role not in ('student', 'parent') or new.password_hash is null then
    return new;
  end if;

  v_email := public.login_email_for(new.id);

  if exists (select 1 from auth.users where id = new.id) then
    -- มีบัญชีแล้ว: อัปเดตเฉพาะตอนที่ hash เปลี่ยนจริง
    if tg_op = 'UPDATE' and new.password_hash is not distinct from old.password_hash then
      return new;
    end if;
    update auth.users
       set encrypted_password = new.password_hash,
           updated_at = now()
     where id = new.id
       and email = v_email;
  else
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
      email_change, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', new.id, 'authenticated', 'authenticated', v_email, new.password_hash,
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', '',
      '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), new.id, new.id::text, 'email',
      jsonb_build_object('sub', new.id::text, 'email', v_email, 'email_verified', true),
      now(), now(), now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_login_account on public.users;
create trigger trg_sync_login_account
  after insert or update or delete on public.users
  for each row execute function public.fn_sync_login_account();

-- ---------------------------------------------------------------------
-- 3) สร้างบัญชีให้นักเรียน/ผู้ปกครองที่มีอยู่ (trigger สร้างบัญชีให้แถวที่ยังไม่มีบัญชี)
-- ---------------------------------------------------------------------
update public.users
   set password_hash = password_hash
 where role in ('student', 'parent')
   and password_hash is not null;

-- ---------------------------------------------------------------------
-- 4) login_lookup: เพิ่ม email ให้นักเรียน/ผู้ปกครอง (ยังคืนข้อมูลเดิมไว้ให้เว็บเวอร์ชันเก่า)
-- ---------------------------------------------------------------------
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
      'grade', u.grade,
      'email', public.login_email_for(u.id)
    );
  end if;

  return json_build_object('role', u.role, 'email', u.email);
end;
$$;

-- ---------------------------------------------------------------------
-- 5) กฎอ่านข้อมูลตามบทบาท (เพิ่มอย่างเดียว)
--    ใช้ฟังก์ชัน security definer เพื่อเลี่ยงกฎวนซ้ำระหว่างตาราง users ↔ teaching_logs
-- ---------------------------------------------------------------------
create or replace function public.my_children_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$ select student_id from public.parent_children where parent_id = auth.uid() $$;

create or replace function public.my_logged_tutor_ids()          -- ครูที่เคยสอนฉัน / สอนลูกฉัน
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct tutor_id from public.teaching_logs
   where student_id = auth.uid()
      or student_id in (select student_id from public.parent_children where parent_id = auth.uid())
$$;

create or replace function public.my_logged_student_ids()        -- นักเรียนที่ฉัน (ครู) เคยลงเวลาสอน
returns setof uuid
language sql stable security definer set search_path = public
as $$ select distinct student_id from public.teaching_logs where tutor_id = auth.uid() $$;

revoke all on function public.my_children_ids() from public, anon;
revoke all on function public.my_logged_tutor_ids() from public, anon;
revoke all on function public.my_logged_student_ids() from public, anon;
grant execute on function public.my_children_ids() to authenticated;
grant execute on function public.my_logged_tutor_ids() to authenticated;
grant execute on function public.my_logged_student_ids() to authenticated;

-- users: นักเรียน/ผู้ปกครองเห็นชื่อครูที่สอน, ผู้ปกครองเห็นลูก, ครูเห็นนักเรียนที่เคยสอน (ไว้แสดงในประวัติ/บิล)
drop policy if exists "p2_users_read_my_tutors" on public.users;
create policy "p2_users_read_my_tutors" on public.users
  for select to authenticated
  using (id in (select public.my_logged_tutor_ids()));

drop policy if exists "p2_users_parent_read_children" on public.users;
create policy "p2_users_parent_read_children" on public.users
  for select to authenticated
  using (id in (select public.my_children_ids()));

drop policy if exists "p2_users_tutor_read_logged_students" on public.users;
create policy "p2_users_tutor_read_logged_students" on public.users
  for select to authenticated
  using (id in (select public.my_logged_student_ids()));

-- teaching_logs: ผู้ปกครองเห็นประวัติของลูก (นักเรียน/ครู/แอดมิน มีกฎเดิมอยู่แล้ว)
drop policy if exists "p2_logs_parent_read_children" on public.teaching_logs;
create policy "p2_logs_parent_read_children" on public.teaching_logs
  for select to authenticated
  using (student_id in (select public.my_children_ids()));

-- parent_children: ผู้ปกครองเห็นการผูกของตัวเอง
drop policy if exists "p2_parent_children_read_own" on public.parent_children;
create policy "p2_parent_children_read_own" on public.parent_children
  for select to authenticated
  using (parent_id = auth.uid());

commit;

-- ---------------------------------------------------------------------
-- ตรวจผลหลังรัน: จำนวนนักเรียน/ผู้ปกครองที่มีรหัส vs จำนวนบัญชีล็อกอินที่สร้าง (ควรเท่ากัน)
-- select (select count(*) from public.users where role in ('student','parent') and password_hash is not null) as with_password,
--        (select count(*) from auth.users where email like '%@student.puniq.invalid') as login_accounts;
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- ROLLBACK STEP 1
-- begin;
--   drop trigger if exists trg_sync_login_account on public.users;
--   drop function if exists public.fn_sync_login_account();
--   drop policy if exists "p2_users_read_my_tutors" on public.users;
--   drop policy if exists "p2_users_parent_read_children" on public.users;
--   drop policy if exists "p2_users_tutor_read_logged_students" on public.users;
--   drop policy if exists "p2_logs_parent_read_children" on public.teaching_logs;
--   drop policy if exists "p2_parent_children_read_own" on public.parent_children;
--   delete from auth.users where email like '%@student.puniq.invalid';
-- commit;
-- (login_lookup เวอร์ชันใหม่คืนข้อมูลเดิมครบ ไม่ต้องย้อน)
-- ---------------------------------------------------------------------
