import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ManageCourse() {
  const [tutors, setTutors] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]); 
  
  const [selectedTutorId, setSelectedTutorId] = useState('');
  
  // 🔴 1. เพิ่ม State เก็บค่าตั้งต้น เพื่อใช้เปรียบเทียบส่วนต่างตอนกดเซฟ
  const [initialStudentIds, setInitialStudentIds] = useState([]);
  const [initialGroupIds, setInitialGroupIds] = useState([]);

  const [assignedStudentIds, setAssignedStudentIds] = useState([]);
  const [assignedGroupIds, setAssignedGroupIds] = useState([]); 
  
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMapping, setLoadingMapping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoadingInitial(true);
      
      // 🔴 2. รวบตึงคำสั่งดึงข้อมูล 3 ตารางให้ยิงพร้อมกันทีเดียว (เร็วกว่าเดิม 3 เท่า)
      const [
        { data: tutorsData },
        { data: studentsData },
        { data: groupsData }
      ] = await Promise.all([
        supabase.from('users').select('id, name, username').eq('role', 'tutor').order('name'),
        supabase.from('users').select('id, name, username, grade').eq('role', 'student').order('grade'),
        supabase.from('groups').select('*').order('group_name')
      ]);

      if (tutorsData) setTutors(tutorsData);
      if (studentsData) setStudents(studentsData);
      if (groupsData) setGroups(groupsData);
      
      setLoadingInitial(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedTutorId) {
      setAssignedStudentIds([]);
      setAssignedGroupIds([]);
      setInitialStudentIds([]);
      setInitialGroupIds([]);
      return;
    }

    const fetchMappings = async () => {
      setLoadingMapping(true);
      
      // 🔴 3. รวบตึงคำสั่งดึงประวัติการจับคู่ 2 ตารางให้ยิงพร้อมกัน
      const [
        { data: studentData },
        { data: groupData }
      ] = await Promise.all([
        supabase.from('tutor_students').select('student_id').eq('tutor_id', selectedTutorId),
        supabase.from('tutor_groups').select('group_id').eq('tutor_id', selectedTutorId)
      ]);

      const sIds = studentData ? studentData.map(item => item.student_id) : [];
      const gIds = groupData ? groupData.map(item => item.group_id) : [];

      setAssignedStudentIds(sIds);
      setInitialStudentIds(sIds); // จำค่าตั้งต้นของนักเรียน

      setAssignedGroupIds(gIds);
      setInitialGroupIds(gIds); // จำค่าตั้งต้นของกลุ่ม
      
      setLoadingMapping(false);
    };

    fetchMappings();
    setMessage('');
  }, [selectedTutorId]);

  const handleToggleStudent = (studentId) => {
    setAssignedStudentIds(prev => prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]);
  };

  const handleToggleGroup = (groupId) => {
    setAssignedGroupIds(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]);
  };

  const handleSaveMapping = async () => {
    if (!selectedTutorId) return;
    setSaving(true);
    setMessage('');

    try {
      // 🔴 4. ลอจิกการหาความต่าง (Diff) เพื่อหลีกเลี่ยงการลบแล้วเขียนใหม่
      const studentsToAdd = assignedStudentIds.filter(id => !initialStudentIds.includes(id));
      const studentsToRemove = initialStudentIds.filter(id => !assignedStudentIds.includes(id));

      const groupsToAdd = assignedGroupIds.filter(id => !initialGroupIds.includes(id));
      const groupsToRemove = initialGroupIds.filter(id => !assignedGroupIds.includes(id));

      const promises = [];

      // จัดการเด็กนักเรียนเดี่ยว
      if (studentsToAdd.length > 0) {
        promises.push(supabase.from('tutor_students').insert(
          studentsToAdd.map(id => ({ tutor_id: selectedTutorId, student_id: id }))
        ));
      }
      if (studentsToRemove.length > 0) {
        promises.push(supabase.from('tutor_students')
          .delete()
          .eq('tutor_id', selectedTutorId)
          .in('student_id', studentsToRemove)
        );
      }

      // จัดการกลุ่มนักเรียน
      if (groupsToAdd.length > 0) {
        promises.push(supabase.from('tutor_groups').insert(
          groupsToAdd.map(id => ({ tutor_id: selectedTutorId, group_id: id }))
        ));
      }
      if (groupsToRemove.length > 0) {
        promises.push(supabase.from('tutor_groups')
          .delete()
          .eq('tutor_id', selectedTutorId)
          .in('group_id', groupsToRemove)
        );
      }

      // ยิงคำสั่งอัปเดตทั้งหมดพร้อมกัน
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      // อัปเดตค่าตั้งต้นใหม่ให้ตรงกับปัจจุบัน
      setInitialStudentIds(assignedStudentIds);
      setInitialGroupIds(assignedGroupIds);

      setMessage('✅ บันทึกสิทธิ์การสอนและกลุ่มสำเร็จ!');
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) return <div className="p-10 text-gray-500 animate-pulse text-center">กำลังโหลดข้อมูล...</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ระบบมอบหมายผู้สอน (Manage Assign)</h1>
          <p className="text-gray-500 mt-1">กำหนดนักเรียนและกลุ่มเรียนที่คุณครูแต่ละท่านรับผิดชอบ</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-bold text-gray-800 mb-4 border-b pb-2">1. เลือกคุณครูผู้สอน</h2>
        <select value={selectedTutorId} onChange={(e) => setSelectedTutorId(e.target.value)} className="w-full md:w-1/2 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-gray-50 font-medium">
          <option value="">-- กรุณาเลือกคุณครู --</option>
          {tutors.map(tutor => <option key={tutor.id} value={tutor.id}>{tutor.name || tutor.username}</option>)}
        </select>
      </div>

      {selectedTutorId && (
        <div className="space-y-6">
          {message && <div className={`p-4 rounded-xl text-sm font-semibold border ${message.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{message}</div>}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h2 className="text-base font-bold text-gray-800">2. เลือกกลุ่มนักเรียนที่รับผิดชอบ</h2>
              <span className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold">เลือกแล้ว {assignedGroupIds.length} กลุ่ม</span>
            </div>
            {loadingMapping ? <p className="text-gray-400 py-4 text-center">กำลังโหลดข้อมูลกลุ่ม...</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groups.map(group => (
                  <label key={group.id} className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${assignedGroupIds.includes(group.id) ? 'border-blue-500 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}>
                    <input type="checkbox" className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" checked={assignedGroupIds.includes(group.id)} onChange={() => handleToggleGroup(group.id)} />
                    <span className={`ml-3 font-semibold text-sm ${assignedGroupIds.includes(group.id) ? 'text-blue-900' : 'text-gray-700'}`}>{group.group_name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h2 className="text-base font-bold text-gray-800">3. เลือกนักเรียนเดี่ยวเพิ่มเติม (ถ้ามี)</h2>
              <span className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold">เลือกแล้ว {assignedStudentIds.length} คน</span>
            </div>
            {loadingMapping ? <p className="text-gray-400 py-4 text-center">กำลังโหลดข้อมูลนักเรียน...</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {students.map(student => (
                  <label key={student.id} className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${assignedStudentIds.includes(student.id) ? 'border-blue-500 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}>
                    <input type="checkbox" className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" checked={assignedStudentIds.includes(student.id)} onChange={() => handleToggleStudent(student.id)} />
                    <div className="ml-3">
                      <span className={`block font-semibold text-sm ${assignedStudentIds.includes(student.id) ? 'text-blue-900' : 'text-gray-800'}`}>{student.name || student.username}</span>
                      {student.grade && <span className="text-xs text-gray-500">ชั้น: {student.grade}</span>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={handleSaveMapping} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition shadow-sm disabled:opacity-70 text-sm">
              {saving ? 'กำลังบันทึกข้อมูล...' : 'บันทึกการรับผิดชอบทั้งหมด'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}