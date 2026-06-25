import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ManageCustomCourse() {
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [groups, setGroups] = useState([]); 
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [courseName, setCourseName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [studentRate, setStudentRate] = useState('');
  const [tutorRate, setTutorRate] = useState('');
  
  const [courseTargetType, setCourseTargetType] = useState('individual'); 
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(''); 
  
  const [selectedTutorIds, setSelectedTutorIds] = useState([]);
  const [tutorSearchTerm, setTutorSearchTerm] = useState('');
  const [isTutorDropdownOpen, setIsTutorDropdownOpen] = useState(false);
  const tutorDropdownRef = useRef(null);

  const [editingCourseId, setEditingCourseId] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tutorDropdownRef.current && !tutorDropdownRef.current.contains(event.target)) {
        setIsTutorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [
      { data: coursesData },
      { data: studentsData },
      { data: tutorsData },
      { data: groupsData } 
    ] = await Promise.all([
      supabase.from('custom_courses').select(`
        *,
        student:users!custom_courses_student_id_fkey(name, username),
        group:groups(group_name),
        course_tutors (
           tutor_id,
           tutor:users!course_tutors_tutor_id_fkey(name, username)
        )
      `).order('created_at', { ascending: false }),
      supabase.from('users').select('id, name, username').eq('role', 'student').order('name'),
      supabase.from('users').select('id, name, username').eq('role', 'tutor').neq('username', 'Classroom').order('name'),
      supabase.from('groups').select('id, group_name').order('group_name') 
    ]);

    if (coursesData) {
      // 🔴 เพิ่มเงื่อนไขกรอง: เอาเฉพาะคอร์สที่ไม่มีครู Username เป็น 'Classroom' ผูกอยู่
      const filteredCourses = coursesData.filter(course => {
        const hasClassroomTutor = course.course_tutors?.some(ct => ct.tutor?.username === 'Classroom');
        return !hasClassroomTutor;
      });
      setCourses(filteredCourses);
    }
    if (studentsData) setStudents(studentsData);
    if (tutorsData) setTutors(tutorsData);
    if (groupsData) setGroups(groupsData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredTutors = useMemo(() => {
    if (!tutorSearchTerm) return tutors;
    return tutors.filter(t => 
      t.username?.toLowerCase().includes(tutorSearchTerm.toLowerCase()) || 
      t.name?.toLowerCase().includes(tutorSearchTerm.toLowerCase())
    );
  }, [tutors, tutorSearchTerm]);

  const handleToggleTutor = (tutorId) => {
    setSelectedTutorIds(prev => 
      prev.includes(tutorId) ? prev.filter(id => id !== tutorId) : [...prev, tutorId]
    );
  };

  const handleEditClick = (course) => {
    setEditingCourseId(course.id);
    setCourseName(course.course_name);
    setGradeLevel(course.grade_level);
    setStudentRate(course.student_hourly_rate);
    setTutorRate(course.tutor_hourly_rate);
    
    if (course.course_tutors) {
        setSelectedTutorIds(course.course_tutors.map(ct => ct.tutor_id));
    } else {
        setSelectedTutorIds([]);
    }
    
    if (course.group_id) {
      setCourseTargetType('group');
      setSelectedGroupId(course.group_id);
      setSelectedStudentId('');
    } else if (course.student_id) {
      setCourseTargetType('individual');
      setSelectedStudentId(course.student_id);
      setSelectedGroupId('');
    } else {
      setCourseTargetType('custom');
      setSelectedStudentId('');
      setSelectedGroupId('');
    }
    
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingCourseId(null);
    setCourseName('');
    setGradeLevel('');
    setStudentRate('');
    setTutorRate('');
    setCourseTargetType('individual');
    setSelectedStudentId('');
    setSelectedGroupId('');
    setSelectedTutorIds([]); 
    setTutorSearchTerm('');
    setMessage('');
  };

  const handleSubmitCourse = async (e) => {
    e.preventDefault();
    if (!courseName.trim() || !gradeLevel.trim() || selectedTutorIds.length === 0) return;
    if (courseTargetType === 'individual' && !selectedStudentId) return;
    if (courseTargetType === 'group' && !selectedGroupId) return;

    setSaving(true);
    setMessage('');

    const coursePayload = {
      course_name: courseName.trim(),
      grade_level: gradeLevel.trim(),
      student_hourly_rate: Number(studentRate) || 0,
      tutor_hourly_rate: Number(tutorRate) || 0,
      student_id: courseTargetType === 'individual' ? selectedStudentId : null,
      group_id: courseTargetType === 'group' ? selectedGroupId : null,
    };

    try {
      let targetCourseId = editingCourseId;

      if (editingCourseId) {
        const { error: updateError } = await supabase.from('custom_courses').update(coursePayload).eq('id', editingCourseId);
        if (updateError) throw updateError;
        await supabase.from('course_tutors').delete().eq('course_id', editingCourseId);
      } else {
        const { data: newCourse, error: insertError } = await supabase.from('custom_courses').insert([coursePayload]).select().single();
        if (insertError) throw insertError;
        targetCourseId = newCourse.id;
      }

      if (targetCourseId && selectedTutorIds.length > 0) {
        const tutorInserts = selectedTutorIds.map(tId => ({
            course_id: targetCourseId,
            tutor_id: tId
        }));
        const { error: junctionError } = await supabase.from('course_tutors').insert(tutorInserts);
        if (junctionError) throw junctionError;
      }

      setMessage(editingCourseId ? '✅ อัปเดตข้อมูลคอร์สพิเศษสำเร็จ!' : '🎉 เปิดคอร์สระบบแบบ Hybrid เรียบร้อยแล้ว!');
      handleCancelEdit();
      fetchData();
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const { error } = await supabase.from('custom_courses').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      alert(`ไม่สามารถสลับสถานะได้: ${error.message}`);
    }
  };

  const handleDeleteCourse = async (id) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบคอร์สนี้ถาวร?')) return;
    setMessage('');
    try {
      const { error } = await supabase.from('custom_courses').delete().eq('id', id);
      if (error) throw error;
      setMessage('🗑️ ลบคอร์สสำเร็จ');
      if (editingCourseId === id) handleCancelEdit();
      fetchData();
    } catch (error) {
      setMessage(`❌ ลบไม่สำเร็จ: ${error.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">จัดการคอร์สพิเศษ (Manage Custom Courses)</h1>
        <p className="text-gray-500 mt-1">สร้างแพ็กเกจเรียนและเคาะราคาเจาะจง รองรับทั้งรูปแบบรายบุคคลและรูปแบบกลุ่มนักเรียน</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold shadow-sm border ${
          message.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      {/* 🔴 ปรับจากกริดซ้ายขวา มาเป็น flex-col จัดระเบียบบน-ล่าง */}
      <div className="flex flex-col space-y-6">
        
        {/* บล็อกส่วนที่ 1: ส่วนฟอร์มเพิ่ม/แก้ไขข้อมูล (อยู่ด้านบน) */}
        <div className={`bg-white rounded-xl shadow-sm border p-6 w-full transition-all overflow-visible ${editingCourseId ? 'border-amber-400 ring-4 ring-amber-50' : 'border-gray-200'}`}>
          <h2 className={`text-base font-bold mb-4 border-b pb-2 ${editingCourseId ? 'text-amber-600' : 'text-gray-800'}`}>
            {editingCourseId ? '✏️ แก้ไขข้อมูลคอร์สพิเศษ' : 'สร้างคอร์สพิเศษใหม่'}
          </h2>

          <form onSubmit={handleSubmitCourse} className="space-y-4">
            {/* จัด Layout ภายในฟอร์มให้ยืดตามแนวกว้างเพื่อให้สมส่วนกับหน้าจอเต็ม */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">ชื่อคอร์สเรียน</label>
                <input type="text" placeholder="เช่น ติวเข้มสอวน. ฟิสิกส์ ม.ปลาย" value={courseName} onChange={(e) => setCourseName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" required />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">ระดับชั้น (สำหรับโชว์หน้าบิล)</label>
                <input type="text" placeholder="เช่น ม.3 (กลุ่มพิเศษ)" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">รูปแบบการเรียนเป้าหมาย</label>
                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
                  <button type="button" onClick={() => { setCourseTargetType('individual'); setSelectedGroupId(''); }} className={`py-1.5 rounded-md text-[10px] font-bold transition-all ${courseTargetType === 'individual' ? 'bg-white text-blue-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}>👤 รายบุคคล</button>
                  <button type="button" onClick={() => { setCourseTargetType('group'); setSelectedStudentId(''); }} className={`py-1.5 rounded-md text-[10px] font-bold transition-all ${courseTargetType === 'group' ? 'bg-white text-purple-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}>👥 รายกลุ่ม</button>
                  <button type="button" onClick={() => { setCourseTargetType('custom'); setSelectedStudentId(''); setSelectedGroupId(''); }} className={`py-1.5 rounded-md text-[10px] font-bold transition-all ${courseTargetType === 'custom' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}>✨ คัสตอมสิทธิ์</button>
                </div>
              </div>

              {courseTargetType === 'individual' && (
                <div className="animate-fadeIn">
                  <label className="block text-xs font-bold text-blue-800 uppercase mb-1">เลือกนักเรียน (ตัวต่อตัว)</label>
                  <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-blue-50 font-medium focus:ring-blue-500" required>
                    <option value="">-- กรุณาเลือกเด็กนักเรียน --</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name || s.username}</option>)}
                  </select>
                </div>
              )}
              
              {courseTargetType === 'group' && (
                <div className="animate-fadeIn">
                  <label className="block text-xs font-bold text-purple-800 uppercase mb-1">เลือกกลุ่มเรียน (Group)</label>
                  <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm bg-purple-50 font-medium text-purple-950 focus:ring-purple-500" required>
                    <option value="">-- กรุณาเลือกกลุ่มการเรียน --</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
                  </select>
                </div>
              )}

              {courseTargetType === 'custom' && (
                <div className="animate-fadeIn p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800">
                   ℹ️ โหมด Custom จะไม่ผูกขาดกับเด็กหรือกลุ่ม เหมาะกับแพ็กเกจสถานที่หรือคอร์สเปิดสาธารณะ
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                ผู้สอนรับผิดชอบ <span className="text-[10px] font-medium text-gray-400">(เลือกแล้ว {selectedTutorIds.length} คน)</span>
              </label>
              
              <div className="relative w-full" ref={tutorDropdownRef}>
                <input 
                  type="text" 
                  placeholder="พิมพ์ค้นหาและติ๊กเลือกคุณครู..." 
                  value={tutorSearchTerm}
                  onChange={(e) => {
                    setTutorSearchTerm(e.target.value);
                    setIsTutorDropdownOpen(true);
                  }}
                  onFocus={() => setIsTutorDropdownOpen(true)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                
                {isTutorDropdownOpen && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredTutors.length > 0 ? (
                      filteredTutors.map(tutor => (
                        <label key={tutor.id} className={`flex items-center px-3 py-2.5 cursor-pointer hover:bg-indigo-50 transition border-b border-gray-50 last:border-0 ${selectedTutorIds.includes(tutor.id) ? 'bg-indigo-50/50' : ''}`}>
                          <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 shrink-0" checked={selectedTutorIds.includes(tutor.id)} onChange={() => handleToggleTutor(tutor.id)} />
                          <span className="ml-3 text-sm font-medium text-gray-700">{tutor.username} {tutor.name ? `(${tutor.name})` : ''}</span>
                        </label>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">ไม่พบคุณครูที่ค้นหา</div>
                    )}
                  </div>
                )}
              </div>
              
              {selectedTutorIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                   {selectedTutorIds.map(tId => {
                      const tutorData = tutors.find(t => t.id === tId);
                      return tutorData ? (
                        <span key={tId} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {tutorData.name || tutorData.username}
                          <button type="button" onClick={() => handleToggleTutor(tId)} className="ml-1 text-indigo-400 hover:text-indigo-900 font-black">×</button>
                        </span>
                      ) : null;
                   })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">เก็บเงินเด็ก (บาท/ชม./คน)</label>
                <input type="number" min="0" value={studentRate} onChange={(e) => setStudentRate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">จ่ายค่าครู (บาท/ชม.)</label>
                <input type="number" min="0" value={tutorRate} onChange={(e) => setTutorRate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
            </div>

            <div className="flex space-x-2 pt-2 justify-end">
              {editingCourseId && (
                <button type="button" onClick={handleCancelEdit} className="px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-lg transition text-sm">ยกเลิก</button>
              )}
              <button type="submit" disabled={saving || selectedTutorIds.length === 0} className={`font-bold py-2.5 px-6 rounded-lg transition text-sm shadow-sm disabled:opacity-50 ${editingCourseId ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                {saving ? 'กำลังบันทึก...' : editingCourseId ? '💾 อัปเดตข้อมูลคอร์ส' : '+ เปิดคอร์สพิเศษใหม่'}
              </button>
            </div>
          </form>
        </div>

        {/* บล็อกส่วนที่ 2: รายการตารางแสดงผลข้อมูลคอร์สที่มีอยู่ (ย้ายลงมาอยู่ด้านล่าง ได้พื้นที่กว้างเต็มตา) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 w-full overflow-hidden">
          <h2 className="text-base font-bold text-gray-800 mb-4 border-b pb-2">รายการคอร์สพิเศษปัจจุบัน ({courses.length})</h2>
          
          {loading ? (
            <div className="p-10 text-center text-gray-400 animate-pulse">กำลังดึงข้อมูลคอร์สทั้งหมด...</div>
          ) : courses.length === 0 ? (
            <div className="p-10 text-center text-gray-400">ยังไม่มีการเปิดคอร์สพิเศษขึ้นในระบบ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase">
                  <tr>
                    <th className="p-4 w-1/4">ชื่อคอร์ส / ระดับชั้น</th>
                    <th className="p-4 w-1/5">รูปแบบเป้าหมาย</th>
                    <th className="p-4 w-1/4">ทีมผู้สอน (Tutor)</th>
                    <th className="p-4 text-right">เรทเด็ก (ต่อคน)</th>
                    <th className="p-4 text-right">เรทครู</th>
                    <th className="p-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {courses.map(course => {
                    const assignedTutorsNames = course.course_tutors?.length > 0 
                      ? course.course_tutors.map(ct => ct.tutor?.name || ct.tutor?.username).join(', ')
                      : 'ยังไม่มีผู้สอน';

                    return (
                      <tr key={course.id} className={`hover:bg-gray-50/50 transition-colors ${course.is_active ? '' : 'bg-gray-50/40 opacity-60'}`}>
                        <td className="p-4">
                          <p className="font-bold text-gray-800 text-sm">{course.course_name}</p>
                          <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-gray-600 font-medium inline-block mt-1">{course.grade_level}</span>
                        </td>
                        <td className="p-4 font-semibold text-sm">
                          {course.group_id ? (
                            <span className="text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-md">👥 กลุ่ม: {course.group?.group_name}</span>
                          ) : course.student_id ? (
                            <span className="text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md">👤 เดี่ยว: {course.student?.name || course.student?.username}</span>
                          ) : (
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md">✨ คัสตอม (เปิดกว้าง)</span>
                          )}
                        </td>
                        <td className="p-4 text-indigo-700 font-semibold text-sm leading-relaxed">
                          {course.course_tutors?.length > 1 ? `👥 ${assignedTutorsNames}` : assignedTutorsNames}
                        </td>
                        <td className="p-4 text-right font-bold text-gray-800 text-sm">฿{course.student_hourly_rate?.toLocaleString()}/ชม.</td>
                        <td className="p-4 text-right font-bold text-gray-600 text-sm">฿{course.tutor_hourly_rate?.toLocaleString()}/ชม.</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center space-x-3">
                            <input type="checkbox" checked={course.is_active} onChange={() => handleToggleStatus(course.id, course.is_active)} className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer" />
                            <button onClick={() => handleEditClick(course)} className="text-amber-500 hover:text-amber-700 font-bold text-sm">แก้ไข</button>
                            <button onClick={() => handleDeleteCourse(course.id)} className="text-red-500 hover:text-red-700 font-bold text-sm">ลบ</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}