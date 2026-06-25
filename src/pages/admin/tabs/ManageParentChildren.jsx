import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ManageParentChildren() {
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [mappings, setMappings] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [selectedParentId, setSelectedParentId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const studentDropdownRef = useRef(null);

  // ดักคลิกปิด Dropdown นักเรียน
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(event.target)) {
        setIsStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [parentsRes, studentsRes, mappingsRes] = await Promise.all([
      // ดึงรายชื่อผู้ใช้ที่เป็นผู้ปกครอง (role: parent)
      supabase.from('users').select('id, name, username').eq('role', 'parent').order('username'),
      // ดึงรายชื่อเด็กนักเรียน (role: student)
      supabase.from('users').select('id, name, username, grade').eq('role', 'student').order('username'),
      // ดึงตารางคู่ความสัมพันธ์ปัจจุบัน
      supabase.from('parent_children').select(`
        parent_id,
        student_id,
        parent:users!parent_children_parent_id_fkey(name, username),
        student:users!parent_children_student_id_fkey(name, username, grade)
      `)
    ]);

    if (parentsRes.data) setParents(parentsRes.data);
    if (studentsRes.data) setStudents(studentsRes.data);
    if (mappingsRes.data) setMappings(mappingsRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // เมื่อ Admin เลือกผู้ปกครอง ให้ไปดึงรายชื่อลูกปัจจุบันของเขามาติ๊กค้างไว้ในฟอร์มอัตโนมัติ
  useEffect(() => {
    if (selectedParentId) {
      const currentChildrenIds = mappings
        .filter(m => m.parent_id === selectedParentId)
        .map(m => m.student_id);
      setSelectedStudentIds(currentChildrenIds);
    } else {
      setSelectedStudentIds([]);
    }
  }, [selectedParentId, mappings]);

  // ตัวกรองค้นหานักเรียน (Autocomplete Search)
  const filteredStudents = useMemo(() => {
    if (!studentSearchTerm) return students;
    return students.filter(s => 
      s.username?.toLowerCase().includes(studentSearchTerm.toLowerCase()) || 
      s.name?.toLowerCase().includes(studentSearchTerm.toLowerCase())
    );
  }, [students, studentSearchTerm]);

  const handleToggleStudent = (studentId) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSaveMapping = async (e) => {
    e.preventDefault();
    if (!selectedParentId) return;

    setSaving(true);
    setMessage('');

    try {
      // 1. ล้างรายชื่อลูกเดิมของผู้ปกครองคนนี้ออกก่อนเพื่ออัปเดตข้อมูลใหม่
      await supabase.from('parent_children').delete().eq('parent_id', selectedParentId);

      // 2. บันทึกรายชื่อลูกชุดใหม่เข้าไป (ถ้ามีเลือกไว้)
      if (selectedStudentIds.length > 0) {
        const insertPayload = selectedStudentIds.map(sId => ({
          parent_id: selectedParentId,
          student_id: sId
        }));

        const { error } = await supabase.from('parent_children').insert(insertPayload);
        if (error) throw error;
      }

      setMessage('✅ ผูกบัญชีครอบครัวผู้ปกครอง-นักเรียน สำเร็จเรียบร้อย!');
      setStudentSearchTerm('');
      setSelectedParentId('');
      setSelectedStudentIds([]);
      fetchData();
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSingleMapping = async (parentId, studentId, parentName, studentName) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ที่จะยกเลิกสิทธิ์การเชื่อมต่อของ ผู้ปกครอง "${parentName}" กับนักเรียน "${studentName}"?`)) return;
    try {
      const { error } = await supabase
        .from('parent_children')
        .delete()
        .eq('parent_id', parentId)
        .eq('student_id', studentId);

      if (error) throw error;
      setMessage('🗑️ ยกเลิกการผูกบัญชีสำเร็จ');
      fetchData();
    } catch (error) {
      setMessage(`❌ ยกเลิกไม่สำเร็จ: ${error.message}`);
    }
  };

  // เพิ่มฟังก์ชันนี้เข้าไปเพื่อจัดการปุ่ม "ล้างค่า"
  const handleCancelEdit = () => {
    setSelectedParentId('');
    setSelectedStudentIds([]);
    setStudentSearchTerm('');
    setMessage('');
  };

  // จัดกลุ่มข้อมูลจับคู่เพื่อนำมาโชว์ในตารางด้านล่างให้ดูง่ายรายครอบครัว
  const groupedTableRows = useMemo(() => {
    const group = {};
    mappings.forEach(m => {
      if (!group[m.parent_id]) {
        group[m.parent_id] = {
          parent_id: m.parent_id,
          parentName: m.parent?.name || m.parent?.username || 'ไม่ระบุชื่อ',
          children: []
        };
      }
      group[m.parent_id].children.push({
        id: m.student_id,
        name: m.student?.name || m.student?.username,
        grade: m.student?.grade
      });
    });
    return Object.values(group);
  }, [mappings]);

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">👨‍👩-👦 จับคู่บัญชีผู้ปกครอง (Parent-Child Mapping)</h1>
        <p className="text-gray-500 mt-1">เชื่อมบัญชีผู้ปกครองเข้ากับรายชื่อนักเรียน เพื่อให้ผู้ปกครองเข้าดูประวัติและบิลของลูกๆ ได้หลายคนในบัญชีเดียว</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold shadow-sm border ${
          message.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      <div className="flex flex-col space-y-6">
        
        {/* บล็อกส่วนที่ 1: ฟอร์มผูกความสัมพันธ์บัญชี (ด้านบน) */}
        <div className={`bg-white rounded-xl shadow-sm border p-6 w-full transition-all overflow-visible ${selectedParentId ? 'border-indigo-400 ring-4 ring-indigo-50' : 'border-gray-200'}`}>
          <h2 className="text-base font-bold mb-4 border-b pb-2 text-gray-800">
            {selectedParentId ? '✏️ แก้ไขการผูกบัญชีลูกนักเรียน' : 'กำหนดสิทธิ์ครอบครัวใหม่'}
          </h2>

          <form onSubmit={handleSaveMapping} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              
              {/* เลือกผู้ปกครอง */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">เลือกผู้ปกครองหลัก</label>
                <select 
                  value={selectedParentId} 
                  onChange={(e) => setSelectedParentId(e.target.value)} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                >
                  <option value="">-- กรุณาเลือกบัญชีผู้ปกครอง --</option>
                  {parents.map(p => <option key={p.id} value={p.id}>{p.username} {p.name ? `(${p.name})` : ''}</option>)}
                </select>
              </div>

              {/* ค้นหาและติ๊กเลือกเด็ก (Checkbox Dropdown) */}
              <div className="relative w-full" ref={studentDropdownRef}>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  รายชื่อนักเรียน (ลูก) <span className="text-[10px] font-medium text-gray-400">(เลือกแล้ว {selectedStudentIds.length} คน)</span>
                </label>
                <input 
                  type="text" 
                  disabled={!selectedParentId}
                  placeholder={selectedParentId ? "พิมพ์ชื่อ หรือ รหัสเด็ก เพื่อค้นหา..." : "🔒 กรุณาเลือกผู้ปกครองด้านซ้ายก่อน..."} 
                  value={studentSearchTerm}
                  onChange={(e) => {
                    setStudentSearchTerm(e.target.value);
                    setIsStudentDropdownOpen(true);
                  }}
                  onFocus={() => setIsStudentDropdownOpen(true)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                
                {isStudentDropdownOpen && selectedParentId && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map(student => (
                        <label key={student.id} className={`flex items-center px-3 py-2.5 cursor-pointer hover:bg-indigo-50 transition border-b border-gray-50 last:border-0 ${selectedStudentIds.includes(student.id) ? 'bg-indigo-50/50' : ''}`}>
                          <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 shrink-0" checked={selectedStudentIds.includes(student.id)} onChange={() => handleToggleStudent(student.id)} />
                          <span className="ml-3 text-sm font-medium text-gray-700">{student.username} {student.name ? `(${student.name})` : ''} <span className="text-xs text-gray-400">[{student.grade || '-'}]</span></span>
                        </label>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">ไม่พบข้อมูลรายชื่อนักเรียน</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ส่วนแสดงแท็กเด็กที่ถูกเลือก */}
            {selectedStudentIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border rounded-lg">
                 {selectedStudentIds.map(sId => {
                    const child = students.find(s => s.id === sId);
                    return child ? (
                      <span key={sId} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs">
                        👦 {child.name || child.username}
                        <button type="button" onClick={() => handleToggleStudent(sId)} className="ml-1.5 text-indigo-400 hover:text-indigo-900 font-black">×</button>
                      </span>
                    ) : null;
                 })}
              </div>
            )}

            <div className="flex space-x-2 pt-2 justify-end">
              {selectedParentId && (
                <button type="button" onClick={handleCancelEdit} className="px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-lg transition text-sm">ล้างค่า</button>
              )}
              <button type="submit" disabled={saving || !selectedParentId} className="font-bold py-2 px-6 rounded-lg transition text-sm shadow-sm disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700 text-white">
                {saving ? 'กำลังบันทึกข้อมูล...' : '💾 บันทึกการผูกบัญชีครอบครัว'}
              </button>
            </div>
          </form>
        </div>

        {/* บล็อกส่วนที่ 2: ตารางแสดงข้อมูลสรุปครอบครัว (ด้านล่าง) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 w-full overflow-hidden">
          <h2 className="text-base font-bold text-gray-800 mb-4 border-b pb-2">รายชื่อบัญชีครอบครัวในระบบปัจจุบัน ({groupedTableRows.length} ครอบครัว)</h2>
          
          {loading ? (
            <div className="p-10 text-center text-gray-400 animate-pulse">กำลังประมวลผลโครงสร้างความสัมพันธ์...</div>
          ) : groupedTableRows.length === 0 ? (
            <div className="p-10 text-center text-gray-400">ยังไม่มีการผูกบัญชีผู้ปกครองและเด็กนักเรียนในระบบ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase">
                  <tr>
                    <th className="p-4 w-1/3 text-sm">ผู้ปกครองหลัก (Parent)</th>
                    <th className="p-4 w-1/2 text-sm">นักเรียนในความดูแล (Children)</th>
                    <th className="p-4 text-center text-sm">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupedTableRows.map(row => (
                    <tr key={row.parent_id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 align-top">
                        <p className="font-bold text-gray-900 text-base">👨‍💼 {row.parentName}</p>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col space-y-2">
                          {row.children.map(child => (
                            <div key={child.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg p-2 max-w-md shadow-2xs group">
                              <span className="font-semibold text-gray-700 text-xs">
                                👦 {child.name} <span className="text-gray-400 font-normal">({child.grade || 'ไม่ระบุชั้น'})</span>
                              </span>
                              <button 
                                onClick={() => handleRemoveSingleMapping(row.parent_id, child.id, row.parentName, child.name)}
                                className="text-red-400 hover:text-red-700 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition duration-150"
                              >
                                ยกเลิกการเชื่อมต่อ ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-center align-top">
                        <button 
                          onClick={() => {
                            // จำลองคอร์สเพื่อดึงข้อมูลมากางฟอร์มแก้ไขด้านบน
                            setSelectedParentId(row.parent_id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }} 
                          className="text-indigo-600 hover:text-indigo-900 font-bold text-sm bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-md transition"
                        >
                          แก้ไขรายชื่อลูก
                        </button>
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