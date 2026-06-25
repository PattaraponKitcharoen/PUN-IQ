import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ReserveRoom() {
  const [dummyTutorId, setDummyTutorId] = useState(null);
  const [students, setStudents] = useState([]);
  const [roomPackages, setRoomPackages] = useState([]); 
  
  const [roomName, setRoomName] = useState(''); 
  
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const dropdownRef = useRef(null);

  const [pricePerRound, setPricePerRound] = useState(200);
  const [hoursPerRound, setHoursPerRound] = useState(1.5);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [editingPackageId, setEditingPackageId] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [studentsRes, tutorRes] = await Promise.all([
      supabase.from('users').select('id, name, username, grade').eq('role', 'student').order('username'),
      supabase.from('users').select('id').eq('username', 'Classroom').single() 
    ]);

    if (studentsRes.data) setStudents(studentsRes.data);
    
    if (tutorRes.data) {
      setDummyTutorId(tutorRes.data.id);
      fetchRoomPackages(tutorRes.data.id); 
    } else {
      setMessage('⚠️ ไม่พบบัญชีคุณครู "Classroom" ในระบบ กรุณาสร้างไอดีนี้ก่อนใช้งาน');
      setLoading(false);
    }
  };

  // 🔴 1. ปรับปรุงการอ่านข้อมูลสิทธิ์ห้องเช่าผ่านตารางเชื่อม Many-to-Many
  const fetchRoomPackages = async (tutorId) => {
    const { data, error } = await supabase.from('custom_courses')
      .select(`
        *, 
        student:users!custom_courses_student_id_fkey(name, username),
        course_tutors!inner(tutor_id)
      `)
      .eq('course_tutors.tutor_id', tutorId)
      .order('created_at', { ascending: false });
      
    if (data) setRoomPackages(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredStudents = useMemo(() => {
    if (!studentSearchTerm) return students;
    return students.filter(s => 
      s.username?.toLowerCase().includes(studentSearchTerm.toLowerCase()) || 
      s.name?.toLowerCase().includes(studentSearchTerm.toLowerCase())
    );
  }, [students, studentSearchTerm]);

  const handleEditClick = (pkg) => {
    setEditingPackageId(pkg.id);
    setSelectedStudentId(pkg.student_id);
    setStudentSearchTerm(`${pkg.student?.username} ${pkg.student?.name ? `(${pkg.student?.name})` : ''}`);
    setPricePerRound(pkg.student_hourly_rate);
    
    let baseName = pkg.course_name;
    const match = pkg.course_name.match(/(.*) \(([\d.]+) ชม\.\/รอบ/);
    if (match) {
      baseName = match[1];
      setHoursPerRound(Number(match[2]));
    } else {
      setHoursPerRound(1.5);
    }
    setRoomName(baseName);
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const handleCancelEdit = () => {
    setEditingPackageId(null);
    setRoomName('');
    setSelectedStudentId('');
    setStudentSearchTerm('');
    setPricePerRound(200);
    setHoursPerRound(1.5);
    setMessage('');
  };

  const handleSubmitPackage = async (e) => {
    e.preventDefault();
    if (!dummyTutorId) {
      setMessage('❌ ไม่สามารถทำรายการได้เนื่องจากไม่พบไอดีคุณครู Classroom'); return;
    }
    if (!selectedStudentId) {
      setMessage('❌ กรุณาเลือกนักเรียนผู้รับสิทธิ์เช่าห้อง'); return;
    }

    setSaving(true);
    setMessage('');

    try {
      const displayName = roomName.trim() ? roomName.trim() : 'เช่าห้อง';
      const courseName = `${displayName} (${hoursPerRound} ชม./รอบ = ${pricePerRound} บาท)`;

      // 🔴 2. ถอดคอลัมน์ tutor_id ออกจาก Payload หลักของตาราง custom_courses
      const payload = {
        student_id: selectedStudentId,
        course_name: courseName,
        grade_level: 'สถานที่',
        student_hourly_rate: pricePerRound, 
        tutor_hourly_rate: pricePerRound
      };

      if (editingPackageId) {
        const { error } = await supabase
          .from('custom_courses')
          .update(payload)
          .eq('id', editingPackageId);

        if (error) throw error;
        setMessage('✅ อัปเดตรายละเอียดสิทธิ์แพ็กเกจเช่าห้องเรียนสำเร็จ!');
      } else {
        // 🔴 3. บันทึกคอร์สใหม่ลงตาราง และดึง ID ออกมาผูกตารางเชื่อมต่อ
        const { data: newCourse, error: courseError } = await supabase
          .from('custom_courses')
          .insert([payload])
          .select()
          .single();

        if (courseError) throw courseError;

        // 🔴 4. นำ ID คอร์สเช่าสถานที่ใหม่คู่กับไอดี Classroom ไปผูกตารางเชื่อม course_tutors
        const { error: junctionError } = await supabase
          .from('course_tutors')
          .insert([{
             course_id: newCourse.id,
             tutor_id: dummyTutorId
          }]);

        if (junctionError) throw junctionError;

        const { data: checkExist } = await supabase
          .from('tutor_students')
          .select('*')
          .eq('tutor_id', dummyTutorId)
          .eq('student_id', selectedStudentId);

        if (!checkExist || checkExist.length === 0) {
          await supabase.from('tutor_students').insert([{
            tutor_id: dummyTutorId,
            student_id: selectedStudentId
          }]);
        }
        setMessage('✅ ออกสิทธิ์แพ็กเกจการเช่าห้องเรียนให้นักเรียนสำเร็จเรียบร้อย!');
      }

      handleCancelEdit();
      fetchRoomPackages(dummyTutorId);
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
      fetchRoomPackages(dummyTutorId);
    } catch (error) {
      alert(`ไม่สามารถสลับสถานะได้: ${error.message}`);
    }
  };

  const handleDeletePackage = async (id) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบสิทธิ์แพ็กเกจเช่าห้องนี้ถาวร?')) return;
    setMessage('');
    try {
      const { error } = await supabase.from('custom_courses').delete().eq('id', id);
      if (error) throw error;
      setMessage('🗑️ ลบแพ็กเกจเช่าห้องสำเร็จ');
      if (editingPackageId === id) handleCancelEdit();
      fetchRoomPackages(dummyTutorId);
    } catch (error) {
      setMessage(`❌ ลบไม่สำเร็จ: ${error.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🎟️ จัดการแพ็กเกจสิทธิ์เช่าห้องเรียน (Reserve Room)</h1>
        <p className="text-gray-500 mt-1">สร้างสิทธิ์ห้องเช่าผูกกับนักเรียน เพื่อให้ไอดี Classroom นำไปล็อกเวลาใช้งานภายหลัง</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold shadow-sm border ${message.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className={`bg-white rounded-xl shadow-sm border p-6 lg:col-span-1 h-fit transition-all ${editingPackageId ? 'border-amber-400 ring-4 ring-amber-50' : 'border-gray-200'}`}>
          <h2 className={`text-base font-bold mb-4 border-b pb-2 ${editingPackageId ? 'text-amber-600' : 'text-gray-800'}`}>
            {editingPackageId ? 'แก้ไขข้อมูลแพ็กเกจห้องเช่า' : 'ออกแพ็กเกจสิทธิ์ใหม่'}
          </h2>
          <form onSubmit={handleSubmitPackage} className="space-y-4">
            
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">ชื่อห้อง / รายละเอียดแพ็กเกจ</label>
              <input 
                type="text" 
                placeholder="เช่น ห้อง 101, ห้อง VIP, โซนบอร์ดเกม..." 
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                required
              />
            </div>

            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">ชื่อนักเรียนผู้เช่า</label>
              <input 
                type="text" 
                placeholder="พิมพ์รหัสหรือชื่อนักเรียนเพื่อค้นหา..." 
                value={studentSearchTerm}
                onChange={(e) => {
                  setStudentSearchTerm(e.target.value);
                  setIsStudentDropdownOpen(true);
                  setSelectedStudentId('');
                }}
                onFocus={() => setIsStudentDropdownOpen(true)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
              />
              {isStudentDropdownOpen && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map(s => (
                      <li 
                        key={s.id} 
                        onClick={() => {
                          setSelectedStudentId(s.id);
                          setStudentSearchTerm(`${s.username} ${s.name ? `(${s.name})` : ''}`);
                          setIsStudentDropdownOpen(false);
                        }}
                        className="px-3 py-2.5 text-sm cursor-pointer hover:bg-indigo-50 font-medium text-gray-700 border-b border-gray-50 last:border-0"
                      >
                        {s.username} {s.name ? `(${s.name})` : ''}
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-xs text-gray-500 text-center">ไม่พบรายชื่อนักเรียน</li>
                  )}
                </ul>
              )}
              <input type="text" required value={selectedStudentId} className="h-0 w-0 opacity-0 absolute" onChange={() => {}}/>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">เวลาเกณฑ์ (ชม.) / รอบ</label>
                <input type="number" step="0.25" min="0.25" value={hoursPerRound} onChange={(e) => setHoursPerRound(Number(e.target.value))} className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-900" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">ราคาเหมา (บาท) / รอบ</label>
                <input type="number" min="0" value={pricePerRound} onChange={(e) => setPricePerRound(Number(e.target.value))} className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-900" required />
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              {editingPackageId && (
                <button type="button" onClick={handleCancelEdit} className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-lg transition text-sm">ยกเลิก</button>
              )}
              <button 
                type="submit" 
                disabled={saving || !selectedStudentId || !dummyTutorId} 
                className={`font-bold py-2.5 px-4 rounded-lg transition text-sm shadow-sm disabled:opacity-50 ${editingPackageId ? 'w-2/3 bg-amber-500 hover:bg-amber-600 text-white' : 'w-full bg-emerald-600 hover:bg-emerald-700 text-white'}`}
              >
                {saving ? 'กำลังบันทึก...' : editingPackageId ? '💾 อัปเดตแพ็กเกจ' : 'อนุมัติสิทธิ์แพ็กเกจ'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2 overflow-hidden">
          <h2 className="text-base font-bold text-gray-800 mb-4 border-b pb-2">สิทธิ์แพ็กเกจห้องเช่าปัจจุบัน ({roomPackages.length})</h2>
          
          {loading ? (
            <div className="p-10 text-center text-gray-400 animate-pulse">กำลังดึงข้อมูลสิทธิ์ทั้งหมด...</div>
          ) : roomPackages.length === 0 ? (
            <div className="p-10 text-center text-gray-400">ยังไม่มีการออกสิทธิ์เช่าห้องในระบบ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase">
                  <tr>
                    <th className="p-3">รายละเอียดแพ็กเกจ</th>
                    <th className="p-3">ผู้เช่า (นักเรียน)</th>
                    <th className="p-3 text-right">เรทราคา (รอบละ)</th>
                    <th className="p-3 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {roomPackages.map(pkg => (
                    <tr key={pkg.id} className={`hover:bg-gray-50/50 transition-colors ${pkg.is_active ? '' : 'bg-gray-50/40 opacity-60'}`}>
                      <td className="p-3">
                        <p className="font-bold text-emerald-700 text-sm">{pkg.course_name}</p>
                      </td>
                      <td className="p-3 font-semibold text-gray-800">
                        👤 {pkg.student?.name || pkg.student?.username}
                      </td>
                      <td className="p-3 text-right font-bold text-gray-800">฿{pkg.student_hourly_rate}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center space-x-3">
                          <input 
                            title="สลับการเปิด/ปิดใช้งาน"
                            type="checkbox" 
                            checked={pkg.is_active} 
                            onChange={() => handleToggleStatus(pkg.id, pkg.is_active)} 
                            className="w-3.5 h-3.5 text-emerald-600 border-gray-300 rounded cursor-pointer" 
                          />
                          <button onClick={() => handleEditClick(pkg)} className="text-amber-500 hover:text-amber-700 font-bold flex items-center space-x-1">
                            <span>แก้ไข</span>
                          </button>
                          <button onClick={() => handleDeletePackage(pkg.id)} className="text-red-500 hover:text-red-700 font-bold">ลบทิ้ง</button>
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