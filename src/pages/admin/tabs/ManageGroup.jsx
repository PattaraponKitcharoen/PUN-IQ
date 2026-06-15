import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ManageGroup() {
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  
  // 💡 คงค่า State สำหรับจำค่าเริ่มต้น เพื่อใช้เทียบส่วนต่างตอนกดเซฟ (ห้ามลบเด็ดขาด 🛡️)
  const [initialAssignedIds, setInitialAssignedIds] = useState([]); 
  const [assignedStudentIds, setAssignedStudentIds] = useState([]);
  
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // คงช่องค้นหาไว้ช่วยกรองชื่อกลุ่ม

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMapping, setLoadingMapping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 🚀 โหลดข้อมูลแบบคู่ขนาน (Promise.all) ดึงมาทั้งหมดเลย ไม่ต้องดักช่วงหน้าแล้ว
  const fetchData = async () => {
    setLoadingInitial(true);

    let groupQuery = supabase.from('groups').select('*');
    if (searchTerm) {
      groupQuery = groupQuery.ilike('group_name', `%${searchTerm}%`);
    }

    const [
      { data: groupsData, error: groupErr },
      { data: studentsData }
    ] = await Promise.all([
      groupQuery.order('group_name'),
      supabase.from('users').select('id, name, username, grade').eq('role', 'student').order('grade')
    ]);

    if (!groupErr && groupsData) setGroups(groupsData);
    if (studentsData) setStudents(studentsData);
    
    setLoadingInitial(false);
  };

  // ดักฟังแค่ตอนพิมพ์ค้นหากลุ่ม (ใช้ Debounce ช่วยหน่วงเวลา)
  useEffect(() => {
    if (searchTerm === '') {
      fetchData();
    } else {
      const delayDebounceFn = setTimeout(() => {
        fetchData();
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (!selectedGroupId) {
      setAssignedStudentIds([]);
      setInitialAssignedIds([]);
      return;
    }

    const fetchGroupMembers = async () => {
      setLoadingMapping(true);
      const { data, error } = await supabase
        .from('group_members')
        .select('student_id')
        .eq('group_id', selectedGroupId);

      if (!error && data) {
        const ids = data.map(item => item.student_id);
        setAssignedStudentIds(ids);
        setInitialAssignedIds(ids); 
      }
      setLoadingMapping(false);
    };

    fetchGroupMembers();
    setMessage('');
  }, [selectedGroupId]);

  const handleToggleStudent = (studentId) => {
    setAssignedStudentIds(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
    setMessage('');
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    setMessage('');

    try {
      const { error } = await supabase.from('groups').insert([{ group_name: newGroupName.trim() }]);
      if (error) throw new Error(error.message);
      setMessage('🎉 สร้างกลุ่มใหม่สำเร็จแล้ว!');
      setNewGroupName('');
      fetchData(); 
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setCreatingGroup(false);
    }
  };

  // 🛡️ ระบบเซฟเวอร์ชันปลอดภัยสูง (หาความต่างแทนการลบแล้วเขียนใหม่หมด)
  const handleSaveMembers = async () => {
    if (!selectedGroupId) return;
    setSaving(true);
    setMessage('');

    try {
      const studentsToAdd = assignedStudentIds.filter(id => !initialAssignedIds.includes(id));
      const studentsToRemove = initialAssignedIds.filter(id => !assignedStudentIds.includes(id));
      const promises = [];

      if (studentsToAdd.length > 0) {
        promises.push(supabase.from('group_members').insert(
          studentsToAdd.map(sid => ({ group_id: selectedGroupId, student_id: sid }))
        ));
      }

      if (studentsToRemove.length > 0) {
        promises.push(supabase.from('group_members')
          .delete()
          .eq('group_id', selectedGroupId)
          .in('student_id', studentsToRemove)
        );
      }

      if (promises.length > 0) await Promise.all(promises);

      setInitialAssignedIds(assignedStudentIds); 
      setMessage('💾 บันทึกรายชื่อสมาชิกกลุ่มสำเร็จแล้ว!');
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบกลุ่มนี้? ข้อมูลสมาชิกในกลุ่มจะถูกลบไปด้วย')) return;
    setMessage('');
    try {
      const { error } = await supabase.from('groups').delete().eq('id', selectedGroupId);
      if (error) throw new Error(error.message);
      setMessage('🗑️ ลบกลุ่มเรียบร้อยแล้ว!');
      setSelectedGroupId('');
      fetchData();
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาดในการลบกลุ่ม: ${error.message}`);
    }
  };

  if (loadingInitial) return <div className="p-10 text-gray-500 animate-pulse text-center">กำลังโหลดข้อมูลระบบจัดการกลุ่ม...</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดการกลุ่มนักเรียน (Manage Group)</h1>
          <p className="text-gray-500 mt-1">สร้างกลุ่มและจัดหมวดหมู่นักเรียนเพื่อความสะดวกในการจัดการ</p>
        </div>
        
        {/* ช่องค้นหาเอาไว้ช่วยกรองข้อมูลใน Dropdown เฉดสีกลืนกับปุ่มด้านล่าง */}
        <div className="relative w-full sm:w-64">
           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              placeholder="พิมพ์เพื่อค้นหาชื่อกลุ่ม..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-sm"
            />
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold shadow-sm ${
          message.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-1 h-fit">
          <h2 className="text-base font-bold text-gray-800 mb-4 border-b pb-2">สร้างกลุ่มใหม่</h2>
          <form onSubmit={handleCreateGroup} className="space-y-3">
            <input
              type="text"
              placeholder="ชื่อกลุ่ม เช่น คอร์สสอบเข้า ม.1"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
            <button
              type="submit"
              disabled={creatingGroup}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-lg transition text-sm disabled:opacity-50"
            >
              {creatingGroup ? 'กำลังบันทึก...' : '+ เพิ่มกลุ่มใหม่'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="text-base font-bold text-gray-800">เลือกกลุ่มที่ต้องการจัดการ</h2>
            {selectedGroupId && (
              <button onClick={handleDeleteGroup} className="text-xs text-red-600 hover:text-red-800 font-semibold px-2.5 py-1 bg-red-50 hover:bg-red-100 rounded-md transition">
                ลบกลุ่มนี้ทิ้ง
              </button>
            )}
          </div>
          
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-gray-50 font-medium"
          >
            <option value="">-- {groups.length === 0 ? 'ไม่พบกลุ่มเรียน' : 'กรุณาเลือกกลุ่ม'} --</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.group_name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedGroupId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h2 className="text-lg font-bold text-gray-800">เลือกเด็กนักเรียนเข้ากลุ่ม</h2>
            <div className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold">
              เลือกแล้ว {assignedStudentIds.length} คน
            </div>
          </div>

          {loadingMapping ? (
            <div className="py-10 text-center text-gray-400">กำลังดึงข้อมูลสมาชิก...</div>
          ) : (
            <>
              {students.length === 0 ? (
                <div className="py-10 text-center text-gray-400">ยังไม่มีข้อมูลนักเรียนในระบบ</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {students.map(student => {
                    const isAssigned = assignedStudentIds.includes(student.id);
                    return (
                      <label key={student.id} className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all ${isAssigned ? 'border-blue-500 bg-blue-50/50 shadow-xs' : 'border-gray-100 hover:border-gray-200 bg-white'}`}>
                        <div className="flex-shrink-0 mt-0.5">
                          <input type="checkbox" className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" checked={isAssigned} onChange={() => handleToggleStudent(student.id)} />
                        </div>
                        <div className="ml-3">
                          <p className={`font-semibold ${isAssigned ? 'text-blue-900' : 'text-gray-800'}`}>{student.name || student.username}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs text-gray-500">@{student.username}</span>
                            {student.grade && <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-medium">{student.grade}</span>}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button onClick={handleSaveMembers} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg transition shadow-sm disabled:opacity-70">
                  {saving ? 'กำลังบันทึก...' : 'บันทึกสมาชิกเข้ากลุ่ม'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}