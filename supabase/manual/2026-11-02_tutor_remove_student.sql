-- =====================================================================
-- ให้ครูนำนักเรียนรายบุคคลออกจากความดูแลของตัวเองได้
-- รันใน Supabase Dashboard → SQL Editor ทั้งไฟล์ในครั้งเดียว
--
-- - ลบได้เฉพาะแถวใน tutor_students ของ "ตัวเอง" เท่านั้น (ไม่ต้องเปิดสิทธิ์ delete ตาราง)
-- - ไม่แตะประวัติการสอน (teaching_logs) — log เดิมยังอยู่และแก้ไขได้ตามเดิม
-- - ไม่กระทบกลุ่มเรียน (แอดมินจัดการกลุ่มเหมือนเดิม)
-- - ถ้านำออกผิด ครูเพิ่มกลับได้จากหน้าเดิม (ชื่อ + ระดับชั้นตรงเป๊ะ)
-- =====================================================================

begin;

create or replace function public.tutor_remove_student(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() is distinct from 'tutor' then
    raise exception 'เฉพาะครูเท่านั้น';
  end if;

  delete from public.tutor_students
   where tutor_id = auth.uid() and student_id = p_student_id;

  return case when found then 'removed' else 'not_found' end;
end;
$$;

revoke all on function public.tutor_remove_student(uuid) from public, anon;
grant execute on function public.tutor_remove_student(uuid) to authenticated;

commit;

-- ---------------------------------------------------------------------
-- ROLLBACK
-- drop function if exists public.tutor_remove_student(uuid);
-- ---------------------------------------------------------------------
