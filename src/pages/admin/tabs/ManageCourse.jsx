import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ManageCourse() {
  const [tutors, setTutors] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]); 
  
  const [selectedTutorId, setSelectedTutorId] = useState('');
  
  // State สำหรับระบบค้นหาครู (Auto-complete)
  const [tutorSearchTerm, setTutorSearchTerm] = useState('');
  const [isTutorDropdownOpen, setIsTutorDropdownOpen] = useState(false);
  const tutorDropdownRef = useRef(null);

  // State สำหรับช่องค้นหากลุ่มและนักเรียน
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  
  // 🔴 1. เพิ่ม State สำหรับคุมสถานะแท็บตัวกรอง (all / assigned / unassigned)
  const [groupFilter, setGroupFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
  
  const [initialStudentIds, setInitialStudentIds] = useState([]);
  const [initialGroupIds, setInitialGroupIds] = useState([]);

  const [assignedStudentIds, setAssignedStudentIds] = useState([]);
  const [assignedGroupIds, setAssignedGroupIds] = useState([]); 
  
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMapping, setLoadingMapping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // ดักจับการคลิกพื้นที่อื่นเพื่อปิด Dropdown เลือกครู
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tutorDropdownRef.current && !tutorDropdownRef.current.contains(event.target)) {
        setIsTutorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingInitial(true);
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
      setGroupFilter('all');     // ล้างค่าตัวกรองกลับสู่ค่าเริ่มต้นเมื่อเปลี่ยนครู
      setStudentFilter('all');
      return;
    }

    const fetchMappings = async () => {
      setLoadingMapping(true);
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
      setInitialStudentIds(sIds);
      setAssignedGroupIds(gIds);
      setInitialGroupIds(gIds);
      
      setLoadingMapping(false);
    };

    fetchMappings();
    setMessage('');
  }, [selectedTutorId]);

  const filteredTutors = useMemo(() => {
    if (!tutorSearchTerm) return tutors;
    return tutors.filter(t => 
      t.username?.toLowerCase().includes(tutorSearchTerm.toLowerCase()) || 
      t.name?.toLowerCase().includes(tutorSearchTerm.toLowerCase())
    );
  }, [tutors, tutorSearchTerm]);

  // 🔴 2. ขยายลอจิกการคำนวณ Filter กลุ่มเรียนแบบไฮบริด (คำค้นหา + แท็บสถานะ)
  const filteredGroups = useMemo(() => {
    let result = [...groups];

    // กรองด้วยคำค้นหาด่านแรก
    if (groupSearchTerm) {
      result = result.filter(g => g.group_name.toLowerCase().includes(groupSearchTerm.toLowerCase()));
    }

    // กรองด้วยแท็บสถานะด่านที่สอง
    if (groupFilter === 'assigned') {
      result = result.filter(g => assignedGroupIds.includes(g.id));
    } else if (groupFilter === 'unassigned') {
      result = result.filter(g => !assignedGroupIds.includes(g.id));
    }

    return result;
  }, [groups, groupSearchTerm, groupFilter, assignedGroupIds]);

  // 🔴 3. ขยายลอจิกการคำนวณ Filter นักเรียนเดี่ยวแบบไฮบริด (คำค้นหา + แท็บสถานะ)
  const filteredStudents = useMemo(() => {
    let result = [...students];

    // กรองด้วยคำค้นหาด่านแรก
    if (studentSearchTerm) {
      result = result.filter(s => 
        s.username?.toLowerCase().includes(studentSearchTerm.toLowerCase()) || 
        s.name?.toLowerCase().includes(studentSearchTerm.toLowerCase())
      );
    }

    // กรองด้วยแท็บสถานะด่านที่สอง
    if (studentFilter === 'assigned') {
      result = result.filter(s => assignedStudentIds.includes(s.id));
    } else if (studentFilter === 'unassigned') {
      result = result.filter(s => !assignedStudentIds.includes(s.id));
    }

    return result;
  }, [students, studentSearchTerm, studentFilter, assignedStudentIds]);

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
      const studentsToAdd = assignedStudentIds.filter(id => !initialStudentIds.includes(id));
      const studentsToRemove = initialStudentIds.filter(id => !assignedStudentIds.includes(id));

      const groupsToAdd = assignedGroupIds.filter(id => !initialGroupIds.includes(id));
      const groupsToRemove = initialGroupIds.filter(id => !assignedGroupIds.includes(id));

      const promises = [];

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

      if (promises.length > 0) {
        await Promise.all(promises);
      }

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
    <div className="max-w-5xl mx-auto pb-10">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ระบบมอบหมายผู้สอน (Manage Assign)</h1>
          <p className="text-gray-500 mt-1">กำหนดนักเรียนและกลุ่มเรียนที่คุณครูแต่ละท่านรับผิดชอบ</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 overflow-visible">
        <h2 className="text-base font-bold text-gray-800 mb-4 border-b pb-2">1. ค้นหาและเลือกคุณครูผู้สอน</h2>
        <div className="relative w-full md:w-1/2" ref={tutorDropdownRef}>
          <input 
            type="text" 
            placeholder="พิมพ์ชื่อ หรือ รหัสคุณครู..." 
            value={tutorSearchTerm}
            onChange={(e) => {
              setTutorSearchTerm(e.target.value);
              setIsTutorDropdownOpen(true);
              setSelectedTutorId(''); 
            }}
            onFocus={() => setIsTutorDropdownOpen(true)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white font-medium"
          />
          {isTutorDropdownOpen && (
            <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {filteredTutors.length > 0 ? (
                filteredTutors.map(tutor => (
                  <li 
                    key={tutor.id} 
                    onClick={() => {
                      setSelectedTutorId(tutor.id);
                      setTutorSearchTerm(tutor.name || tutor.username);
                      setIsTutorDropdownOpen(false);
                    }}
                    className="px-4 py-3 text-sm cursor-pointer hover:bg-blue-50 font-medium text-gray-700 border-b border-gray-50 last:border-0"
                  >
                    {tutor.username} {tutor.name ? `(${tutor.name})` : ''}
                  </li>
                ))
              ) : (
                <li className="px-4 py-3 text-sm text-gray-500 text-center">ไม่พบรายชื่อคุณครู</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {selectedTutorId && (
        <div className="space-y-6">
          {message && <div className={`p-4 rounded-xl text-sm font-semibold border shadow-sm ${message.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{message}</div>}

          {/* 🔴 ส่วนที่ 4: เพิ่มชุดปุ่มสลับแท็บตัวกรองให้กับส่วนการรวบรวมกลุ่มเรียน */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 border-b pb-4 gap-3">
              <div>
                <h2 className="text-base font-bold text-gray-800">2. เลือกกลุ่มนักเรียนที่รับผิดชอบ</h2>
                <span className="text-sm bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md font-semibold mt-1 inline-block">เลือกแล้ว {assignedGroupIds.length} กลุ่ม</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-stretch sm:items-center">
                {/* แท็บคัดกรอง 3 โหมด */}
                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg border text-center text-xs font-bold">
                  <button type="button" onClick={() => setGroupFilter('all')} className={`px-3 py-1.5 rounded-md transition-all ${groupFilter === 'all' ? 'bg-white text-blue-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}>ทั้งหมด</button>
                  <button type="button" onClick={() => setGroupFilter('assigned')} className={`px-3 py-1.5 rounded-md transition-all ${groupFilter === 'assigned' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}>กำลังเลือก</button>
                  <button type="button" onClick={() => setGroupFilter('unassigned')} className={`px-3 py-1.5 rounded-md transition-all ${groupFilter === 'unassigned' ? 'bg-white text-amber-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}>ยังไม่ได้เลือก</button>
                </div>
                <input 
                  type="text" 
                  placeholder="🔍 ค้นหากลุ่ม..." 
                  value={groupSearchTerm}
                  onChange={(e) => setGroupSearchTerm(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition w-full sm:w-48"
                />
              </div>
            </div>
            
            {loadingMapping ? <p className="text-gray-400 py-4 text-center">กำลังโหลดข้อมูลกลุ่ม...</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredGroups.length > 0 ? filteredGroups.map(group => (
                  <label key={group.id} className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${assignedGroupIds.includes(group.id) ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-white'}`}>
                    <input type="checkbox" className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" checked={assignedGroupIds.includes(group.id)} onChange={() => handleToggleGroup(group.id)} />
                    <span className={`ml-3 font-semibold text-sm ${assignedGroupIds.includes(group.id) ? 'text-blue-900' : 'text-gray-700'}`}>{group.group_name}</span>
                  </label>
                )) : (
                  <div className="col-span-full py-6 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">ไม่พบข้อมูลกลุ่มตามเงื่อนไขที่กำหนด</div>
                )}
              </div>
            )}
          </div>

          {/* 🔴 ส่วนที่ 5: เพิ่มชุดปุ่มสลับแท็บตัวกรองให้กับส่วนการจัดสิทธิ์นักเรียนรายคน */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 border-b pb-4 gap-3">
              <div>
                <h2 className="text-base font-bold text-gray-800">3. เลือกนักเรียนเดี่ยวเพิ่มเติม (ถ้ามี)</h2>
                <span className="text-sm bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md font-semibold mt-1 inline-block">เลือกแล้ว {assignedStudentIds.length} คน</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-stretch sm:items-center">
                {/* แท็บคัดกรอง 3 โหมด */}
                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg border text-center text-xs font-bold">
                  <button type="button" onClick={() => setStudentFilter('all')} className={`px-3 py-1.5 rounded-md transition-all ${studentFilter === 'all' ? 'bg-white text-blue-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}>ทั้งหมด</button>
                  <button type="button" onClick={() => setStudentFilter('assigned')} className={`px-3 py-1.5 rounded-md transition-all ${studentFilter === 'assigned' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}>กำลังเลือก</button>
                  <button type="button" onClick={() => setStudentFilter('unassigned')} className={`px-3 py-1.5 rounded-md transition-all ${studentFilter === 'unassigned' ? 'bg-white text-amber-600 shadow-2xs' : 'text-gray-500 hover:text-gray-700'}`}>ยังไม่ได้เลือก</button>
                </div>
                <input 
                  type="text" 
                  placeholder="🔍 ค้นหานักเรียน..." 
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition w-full sm:w-48"
                />
              </div>
            </div>
            
            {loadingMapping ? <p className="text-gray-400 py-4 text-center">กำลังโหลดข้อมูลนักเรียน...</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2 pb-2">
                {filteredStudents.length > 0 ? filteredStudents.map(student => (
                  <label key={student.id} className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${assignedStudentIds.includes(student.id) ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-white'}`}>
                    <input type="checkbox" className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 shrink-0" checked={assignedStudentIds.includes(student.id)} onChange={() => handleToggleStudent(student.id)} />
                    <div className="ml-3 truncate">
                      <span className={`block font-semibold text-sm truncate ${assignedStudentIds.includes(student.id) ? 'text-blue-900' : 'text-gray-800'}`}>{student.username} {student.name ? `(${student.name})` : ''}</span>
                      {student.grade && <span className="text-xs text-gray-500">ชั้น: {student.grade}</span>}
                    </div>
                  </label>
                )) : (
                  <div className="col-span-full py-6 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">ไม่พบรายชื่อนักเรียนตามเงื่อนไขที่กำหนด</div>
                )}
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