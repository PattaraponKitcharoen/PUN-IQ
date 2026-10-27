-- =====================================================================
-- Phase 2 — STEP 1b: แก้นักเรียน/ผู้ปกครองที่มีบัญชีล็อกอินเก่า (อีเมลอื่น) อยู่ก่อนแล้ว
-- รันหลัง STEP 1 — รันใน Supabase SQL Editor ทั้งไฟล์ในครั้งเดียว
--
-- ปัญหา: นักเรียน 4 คน (SPIQP001, SPIQH022, SPIQH017, SPIQH002) มีบัญชีใน auth.users
--        อยู่แล้วด้วยอีเมลอื่น และไม่เคยล็อกอินด้วยบัญชีนั้น (last_sign_in_at = NULL)
--        STEP 1 จงใจไม่แตะบัญชีเหล่านี้ จึงยังไม่มีบัญชีแบบอีเมลซ่อน
--
-- สิ่งที่ทำ:
--   1. Trigger เวอร์ชันใหม่: ถ้าเป็นนักเรียน/ผู้ปกครองที่มีบัญชีอยู่แล้ว ให้เปลี่ยนเป็นอีเมลซ่อน
--      + รหัสผ่านปัจจุบันเสมอ (บัญชีของนักเรียน/ผู้ปกครองไม่ได้ใช้ล็อกอินด้วยอีเมลจริงอยู่แล้ว)
--      ครู/แอดมินยังไม่ถูกแตะเหมือนเดิม (trigger ทำงานเฉพาะ role student / parent)
--   2. แปลงบัญชีของ 4 คนนี้ (และใครก็ตามที่อยู่ในสภาพเดียวกัน)
-- =====================================================================

begin;

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
      -- ลบเฉพาะบัญชีที่เป็นอีเมลซ่อนของคนนี้เท่านั้น
      delete from auth.users where id = old.id and email = public.login_email_for(old.id);
    end if;
    return old;
  end if;

  if new.role not in ('student', 'parent') or new.password_hash is null then
    return new;
  end if;

  v_email := public.login_email_for(new.id);

  if exists (select 1 from auth.users where id = new.id) then
    -- บัญชีเป็นอีเมลซ่อนอยู่แล้ว และ hash ไม่เปลี่ยน → ไม่ต้องทำอะไร
    if tg_op = 'UPDATE'
       and new.password_hash is not distinct from old.password_hash
       and exists (select 1 from auth.users where id = new.id and email = v_email) then
      return new;
    end if;

    update auth.users
       set email = v_email,
           encrypted_password = new.password_hash,
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = new.id;

    update auth.identities
       set identity_data = coalesce(identity_data, '{}'::jsonb)
                           || jsonb_build_object('email', v_email, 'email_verified', true),
           updated_at = now()
     where user_id = new.id
       and provider = 'email';
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

-- แปลงบัญชีเก่าของนักเรียน/ผู้ปกครองที่ยังไม่ใช่อีเมลซ่อน (trigger ด้านบนจัดการให้)
update public.users u
   set password_hash = u.password_hash
 where u.role in ('student', 'parent')
   and u.password_hash is not null
   and exists (select 1 from auth.users a where a.id = u.id and a.email <> public.login_email_for(u.id));

commit;

-- ---------------------------------------------------------------------
-- ตรวจผลหลังรัน (ตัวเลข 2 ช่องต้องเท่ากัน)
-- select (select count(*) from public.users where role in ('student','parent') and password_hash is not null) as with_password,
--        (select count(*) from auth.users where email like '%@student.puniq.invalid') as login_accounts;
-- ---------------------------------------------------------------------
