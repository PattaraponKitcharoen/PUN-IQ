-- =====================================================================
-- ให้ครูเพิ่มนักเรียนเข้าความดูแลของตัวเองได้ (ค้นหาแบบชื่อ + ระดับชั้นตรงเป๊ะเท่านั้น)
-- รันใน Supabase Dashboard → SQL Editor ทั้งไฟล์ในครั้งเดียว
--
-- ทำไมต้องเป็นฟังก์ชันใน DB:
--   - ครูค้นหาได้เฉพาะ "ชื่อตรง + ระดับชั้นตรง" ไม่มีการค้นหาบางส่วน
--   - ผลค้นหาคืนแค่ รหัส / ชื่อ / ระดับชั้น (ไม่มีเบอร์โทร ไม่มีข้อมูลอื่น)
--   - ครูเพิ่มได้เฉพาะเข้าความดูแลของ "ตัวเอง" เท่านั้น (ไม่ต้องเปิดสิทธิ์ insert ตาราง tutor_students)
--
-- การเทียบ:
--   ชื่อ     : ตัดช่องว่างหน้า-หลัง, ช่องว่างหลายตัวนับเป็นตัวเดียว, ไม่สนตัวพิมพ์เล็ก/ใหญ่
--   ระดับชั้น : ไม่สนช่องว่าง (ปี1 = ปี 1)
-- =====================================================================

begin;

create or replace function public.tutor_find_student(p_name text, p_grade text)
returns table (id uuid, username text, name text, grade text, already_mine boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.get_my_role() is distinct from 'tutor' then
    raise exception 'เฉพาะครูเท่านั้น';
  end if;

  if coalesce(btrim(p_name), '') = '' or coalesce(btrim(p_grade), '') = '' then
    return;
  end if;

  return query
    select u.id, u.username, u.name, u.grade,
           exists (select 1 from public.tutor_students ts
                    where ts.tutor_id = auth.uid() and ts.student_id = u.id) as already_mine
      from public.users u
     where u.role = 'student'
       and lower(regexp_replace(btrim(u.name), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g'))
       and regexp_replace(coalesce(u.grade, ''), '\s', '', 'g') = regexp_replace(p_grade, '\s', '', 'g')
     order by u.username
     limit 10;
end;
$$;

create or replace function public.tutor_add_student(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() is distinct from 'tutor' then
    raise exception 'เฉพาะครูเท่านั้น';
  end if;

  if not exists (select 1 from public.users where id = p_student_id and role = 'student') then
    raise exception 'ไม่พบนักเรียน';
  end if;

  if exists (select 1 from public.tutor_students where tutor_id = auth.uid() and student_id = p_student_id) then
    return 'exists';
  end if;

  insert into public.tutor_students (tutor_id, student_id) values (auth.uid(), p_student_id);
  return 'added';
end;
$$;

revoke all on function public.tutor_find_student(text, text) from public, anon;
revoke all on function public.tutor_add_student(uuid) from public, anon;
grant execute on function public.tutor_find_student(text, text) to authenticated;
grant execute on function public.tutor_add_student(uuid) to authenticated;

commit;

-- ---------------------------------------------------------------------
-- ROLLBACK
-- drop function if exists public.tutor_find_student(text, text);
-- drop function if exists public.tutor_add_student(uuid);
-- (นักเรียนที่ครูเพิ่มไปแล้วยังอยู่ในตาราง tutor_students — แอดมินจัดการต่อได้จากหน้า Manage Course)
-- ---------------------------------------------------------------------
