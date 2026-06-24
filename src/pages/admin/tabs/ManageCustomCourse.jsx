import { useState, useEffect } from 'react';
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
  const [selectedTutorId, setSelectedTutorId] = useState('');
  
  const [editingCourseId, setEditingCourseId] = useState(null);

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
        tutor:users!custom_courses_tutor_id_fkey(name, username),
        group:groups(group_name) 
      `).order('created_at', { ascending: false }),
      supabase.from('users').select('id, name, username').eq('role', 'student').order('name'),
      // 🔴 กรองเอา Classroom ออกจาก Dropdown เลือกครูด้วย
      supabase.from('users').select('id, name, username').eq('role', 'tutor').neq('username', 'Classroom').order('name'),
      supabase.from('groups').select('id, group_name').order('group_name') 
    ]);

    if (coursesData) {
      // 🔴 คัดกรองเอาเฉพาะคอร์สเรียนจริงๆ (ไม่เอาแพ็กเกจของ Classroom) มาแสดงผล
      const filteredCourses = coursesData.filter(c => c.tutor?.username !== 'Classroom');
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

  const handleEditClick = (course) => {
    setEditingCourseId(course.id);
    setCourseName(course.course_name);
    setGradeLevel(course.grade_level);
    setStudentRate(course.student_hourly_rate);
    setTutorRate(course.tutor_hourly_rate);
    setSelectedTutorId(course.tutor_id);
    
    if (course.group_id) {
      setCourseTargetType('group');
      setSelectedGroupId(course.group_id);
      setSelectedStudentId('');
    } else {
      setCourseTargetType('individual');
      setSelectedStudentId(course.student_id);
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
    setSelectedTutorId('');
    setMessage('');
  };

  const handleSubmitCourse = async (e) => {
    e.preventDefault();
    if (!courseName.trim() || !gradeLevel.trim() || !selectedTutorId) return;
    if (courseTargetType === 'individual' && !selectedStudentId) return;
    if (courseTargetType === 'group' && !selectedGroupId) return;

    setSaving(true);
    setMessage('');

    const payload = {
      course_name: courseName.trim(),
      grade_level: gradeLevel.trim(),
      student_hourly_rate: Number(studentRate) || 0,
      tutor_hourly_rate: Number(tutorRate) || 0,
      tutor_id: selectedTutorId,
      student_id: courseTargetType === 'individual' ? selectedStudentId : null,
      group_id: courseTargetType === 'group' ? selectedGroupId : null,
    };

    try {
      if (editingCourseId) {
        const { error } = await supabase.from('custom_courses').update(payload).eq('id', editingCourseId);
        if (error) throw error;
        setMessage('✅ อัปเดตข้อมูลคอร์สพิเศษสำเร็จ!');
      } else {
        const { error } = await supabase.from('custom_courses').insert([payload]);
        if (error) throw error;
        setMessage('🎉 เปิดคอร์สระบบแบบ Hybrid เรียบร้อยแล้ว!');
      }

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`bg-white rounded-xl shadow-sm border p-6 lg:col-span-1 h-fit transition-all ${editingCourseId ? 'border-amber-400 ring-4 ring-amber-50' : 'border-gray-200'}`}>
          <h2 className={`text-base font-bold mb-4 border-b pb-2 ${editingCourseId ? 'text-amber-600' : 'text-gray-800'}`}>
            {editingCourseId ? '✏️ แก้ไขข้อมูลคอร์สพิเศษ' : 'สร้างคอร์สพิเศษใหม่'}
          </h2>

          <form onSubmit={handleSubmitCourse} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">ชื่อคอร์สเรียน</label>
              <input type="text" placeholder="เช่น ติวเข้มสอวน. ฟิสิกส์ ม.ปลาย" value={courseName} onChange={(e) => setCourseName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" required />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">ระดับชั้น (สำหรับโชว์หน้าบิล)</label>
              <input type="text" placeholder="เช่น ม.3 (กลุ่มพิเศษ)" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" required />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">รูปแบบการเรียน</label>
              <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => { setCourseTargetType('individual'); setSelectedGroupId(''); }}
                  className={`py-1.5 rounded-md text-xs font-bold transition-all ${courseTargetType === 'individual' ? 'bg-white text-blue-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  👤 รายบุคคล (เดี่ยว)
                </button>
                <button
                  type="button"
                  onClick={() => { setCourseTargetType('group'); setSelectedStudentId(''); }}
                  className={`py-1.5 rounded-md text-xs font-bold transition-all ${courseTargetType === 'group' ? 'bg-white text-purple-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  👥 เรียนเป็นกลุ่ม
                </button>
              </div>
            </div>

            {courseTargetType === 'individual' ? (
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">เลือกนักเรียน (ตัวต่อตัว)</label>
                <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 font-medium" required>
                  <option value="">-- กรุณาเลือกเด็กนักเรียน --</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name || s.username}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">เลือกกลุ่มเรียน (Group)</label>
                <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm bg-purple-50/50 font-medium text-purple-950 focus:ring-2 focus:ring-purple-500" required>
                  <option value="">-- กรุณาเลือกกลุ่มการเรียน --</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">เลือกครูผู้รับผิดชอบสอน</label>
              <select value={selectedTutorId} onChange={(e) => setSelectedTutorId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 font-medium" required>
                <option value="">-- กรุณาเลือกคุณครู --</option>
                {tutors.map(t => <option key={t.id} value={t.id}>{t.name || t.username}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">เก็บเงินเด็ก (บาท/ชม./คน)</label>
                <input type="number" min="0" value={studentRate} onChange={(e) => setStudentRate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">จ่ายค่าครู (บาท/ชม.)</label>
                <input type="number" min="0" value={tutorRate} onChange={(e) => setTutorRate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              {editingCourseId && (
                <button type="button" onClick={handleCancelEdit} className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-lg transition text-sm">ยกเลิก</button>
              )}
              <button type="submit" disabled={saving} className={`font-bold py-2.5 px-4 rounded-lg transition text-sm shadow-sm disabled:opacity-50 ${editingCourseId ? 'w-2/3 bg-amber-500 hover:bg-amber-600 text-white' : 'w-full bg-blue-600 hover:bg-blue-700 text-white'}`}>
                {saving ? 'กำลังบันทึก...' : editingCourseId ? '💾 อัปเดตข้อมูล' : '+ เปิดคอร์สพิเศษ'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2 overflow-hidden">
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
                    <th className="p-3">ชื่อคอร์ส / ระดับชั้น</th>
                    <th className="p-3">รูปแบบเป้าหมาย</th>
                    <th className="p-3">ผู้สอน (Tutor)</th>
                    <th className="p-3 text-right">เรทเด็ก (คนละ)</th>
                    <th className="p-3 text-right">เรทครู</th>
                    <th className="p-3 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {courses.map(course => (
                    <tr key={course.id} className={`hover:bg-gray-50/50 transition-colors ${course.is_active ? '' : 'bg-gray-50/40 opacity-60'}`}>
                      <td className="p-3">
                        <p className="font-bold text-gray-800 text-sm">{course.course_name}</p>
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-gray-600 font-medium inline-block mt-1">{course.grade_level}</span>
                      </td>
                      <td className="p-3 font-semibold">
                        {course.group_id ? (
                          <span className="text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded">👥 กลุ่ม: {course.group?.group_name}</span>
                        ) : (
                          <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded">👤 เดี่ยว: {course.student?.name || course.student?.username}</span>
                        )}
                      </td>
                      <td className="p-3 text-indigo-700 font-semibold">
                        {course.tutor?.name || course.tutor?.username || '-'}
                      </td>
                      <td className="p-3 text-right font-bold text-gray-800">฿{course.student_hourly_rate}/ชม.</td>
                      <td className="p-3 text-right font-bold text-gray-600">฿{course.tutor_hourly_rate}/ชม.</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center space-x-2">
                          <input type="checkbox" checked={course.is_active} onChange={() => handleToggleStatus(course.id, course.is_active)} className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded cursor-pointer" />
                          <button onClick={() => handleEditClick(course)} className="text-amber-500 hover:text-amber-700 font-bold">แก้ไข</button>
                          <button onClick={() => handleDeleteCourse(course.id)} className="text-red-500 hover:text-red-700 font-bold">ลบ</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}