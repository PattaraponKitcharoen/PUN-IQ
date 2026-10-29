-- =====================================================================
-- ปิดช่องโหว่ฝั่ง "แก้ไขข้อมูล" ของ course_tutors และ teaching_logs
-- รันใน Supabase Dashboard → SQL Editor ทั้งไฟล์ในครั้งเดียว
--
-- ปัญหา:
--   1. course_tutors: กฎ "Allow all actions for authenticated users on course_tutors"
--      ทำให้ใครก็ตามที่ล็อกอิน (ครู/นักเรียน/ผู้ปกครอง) เพิ่ม/แก้/ลบการผูกครูกับคอร์สได้
--   2. teaching_logs: มีกฎ logs_insert_verified ที่บังคับว่าครูลงเวลาได้เฉพาะนักเรียน
--      ในความดูแล/ในกลุ่ม แต่กฎ tutor_insert_own_logs และ tutor_manage_own_logs (ALL)
--      ทำให้ข้ามเงื่อนไขนี้ได้ (กฎหลายตัวทำงานแบบ "ผ่านตัวใดตัวหนึ่งก็พอ")
--      → ครูลงเวลา/แก้ log ให้นักเรียนคนไหนก็ได้ (กระทบบิลและค่าสอน)
--
-- หลังรัน:
--   course_tutors: แอดมินจัดการได้ทั้งหมด / ครูอ่านได้เฉพาะของตัวเอง
--   teaching_logs (ครู): เพิ่มได้เฉพาะนักเรียนในความดูแล/ในกลุ่ม (กฎเดิม logs_insert_verified)
--                        แก้ได้เฉพาะ log ของตัวเอง และนักเรียนต้องอยู่ในความดูแล/กลุ่ม หรือเคยสอนแล้ว
--                        ลบได้เฉพาะ log ของตัวเอง
--   แอดมิน: เหมือนเดิมทุกอย่าง (admin_manage_all_logs, logs_update, logs_delete)
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) course_tutors
-- ---------------------------------------------------------------------
drop policy if exists "Allow all actions for authenticated users on course_tutors" on public.course_tutors;

drop policy if exists "p4_course_tutors_admin_all" on public.course_tutors;
create policy "p4_course_tutors_admin_all" on public.course_tutors
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

drop policy if exists "p4_course_tutors_tutor_read_own" on public.course_tutors;
create policy "p4_course_tutors_tutor_read_own" on public.course_tutors
  for select to authenticated
  using (tutor_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2) teaching_logs
-- ---------------------------------------------------------------------
-- นักเรียนคนนี้อยู่ในความดูแล หรืออยู่ในกลุ่มของครูที่เรียกใช้หรือไม่
create or replace function public.tutor_can_log_for(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.tutor_students
                  where tutor_id = auth.uid() and student_id = p_student_id)
      or exists (select 1 from public.group_members gm
                   join public.tutor_groups tg on tg.group_id = gm.group_id
                  where tg.tutor_id = auth.uid() and gm.student_id = p_student_id)
$$;
revoke all on function public.tutor_can_log_for(uuid) from public, anon;
grant execute on function public.tutor_can_log_for(uuid) to authenticated;

-- ลบกฎที่ทำให้ข้ามการตรวจสอบได้
drop policy if exists "tutor_insert_own_logs" on public.teaching_logs;   -- INSERT: แค่เช็ค tutor_id
drop policy if exists "tutor_manage_own_logs" on public.teaching_logs;   -- ALL: แค่เช็ค tutor_id (ใช้เป็นเงื่อนไข insert ด้วย)
drop policy if exists "tutor_update_own_logs" on public.teaching_logs;   -- UPDATE: เปลี่ยน student_id เป็นใครก็ได้

-- (กฎ INSERT ที่เหลือของครูคือ logs_insert_verified ซึ่งถูกต้องอยู่แล้ว)

-- แก้ log ของตัวเอง: ผลลัพธ์ต้องยังเป็นของตัวเอง และนักเรียนต้องอยู่ในความดูแล/กลุ่ม หรือเคยสอนแล้ว
drop policy if exists "p4_logs_tutor_update_own" on public.teaching_logs;
create policy "p4_logs_tutor_update_own" on public.teaching_logs
  for update to authenticated
  using (tutor_id = auth.uid())
  with check (
    tutor_id = auth.uid()
    and (public.tutor_can_log_for(student_id)
         or student_id in (select public.my_logged_student_ids()))
  );

-- ลบ log ของตัวเอง (เดิมได้จาก tutor_manage_own_logs)
drop policy if exists "p4_logs_tutor_delete_own" on public.teaching_logs;
create policy "p4_logs_tutor_delete_own" on public.teaching_logs
  for delete to authenticated
  using (tutor_id = auth.uid());

commit;

-- ---------------------------------------------------------------------
-- ตรวจผลหลังรัน: กฎของ course_tutors และ teaching_logs ที่เหลืออยู่
-- select tablename, policyname, cmd, roles::text from pg_policies
--  where schemaname = 'public' and tablename in ('course_tutors', 'teaching_logs')
--  order by tablename, cmd, policyname;
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- ROLLBACK (คืนกฎเดิมทุกตัว)
-- begin;
--   drop policy if exists "p4_course_tutors_admin_all" on public.course_tutors;
--   drop policy if exists "p4_course_tutors_tutor_read_own" on public.course_tutors;
--   create policy "Allow all actions for authenticated users on course_tutors" on public.course_tutors
--     for all to authenticated using (true) with check (true);
--   drop policy if exists "p4_logs_tutor_update_own" on public.teaching_logs;
--   drop policy if exists "p4_logs_tutor_delete_own" on public.teaching_logs;
--   create policy "tutor_insert_own_logs" on public.teaching_logs for insert to authenticated with check (tutor_id = auth.uid());
--   create policy "tutor_manage_own_logs" on public.teaching_logs for all to public using (auth.uid() = tutor_id);
--   create policy "tutor_update_own_logs" on public.teaching_logs for update to authenticated using (tutor_id = auth.uid());
--   drop function if exists public.tutor_can_log_for(uuid);
-- commit;
-- ---------------------------------------------------------------------
