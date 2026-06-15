import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ManageSubject() {
  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 🔴 1. เพิ่ม State สำหรับระบบค้นหาและแบ่งหน้า
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const ITEMS_PER_PAGE = 10; // แสดงหน้าละ 10 วิชา
  

  // 🔴 2. อัปเกรดฟังก์ชันดึงข้อมูลให้รองรับการค้นหาและแบ่งหน้า
  const fetchSubjects = async () => {
    setLoading(true);
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from('subjects')
      .select('*', { count: 'exact' });

    if (searchTerm) {
      query = query.ilike('subject_name', `%${searchTerm}%`);
    }

    const { data, count, error } = await query
      .order('subject_name')
      .range(from, to);

    if (!error && data) {
      setSubjects(data);
      setTotalPages(Math.ceil(count / ITEMS_PER_PAGE) || 1);
    }
    setLoading(false);
  };

  // 🔴 3. เพิ่มระบบหน่วงเวลา (Debounce) สำหรับช่องค้นหา
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (searchTerm === '') {
      fetchSubjects();
    } else {
      const delayDebounceFn = setTimeout(() => {
        fetchSubjects();
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [currentPage, searchTerm]);

  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!newSubject.trim()) return;
    setSaving(true);
    setMessage('');

    try {
      const { error } = await supabase.from('subjects').insert([{ subject_name: newSubject.trim() }]);
      if (error) throw new Error(error.message);
      
      setMessage('✅ เพิ่มรายวิชาสำเร็จ!');
      setNewSubject('');
      fetchSubjects();
    } catch (error) {
      setMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบวิชานี้?')) return;
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw new Error(error.message);
      setMessage('🗑️ ลบวิชาสำเร็จ!');
      fetchSubjects();
    } catch (error) {
      setMessage(`❌ ลบไม่สำเร็จ: ${error.message}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* 🔴 4. เพิ่มช่องค้นหารายวิชาไว้ที่ Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดการรายวิชา (Manage Subject)</h1>
          <p className="text-gray-500 mt-1">เพิ่มรายวิชาในระบบเพื่อเตรียมให้คุณครูเลือกตอนลงเวลาสอน</p>
        </div>
        <div className="relative w-full md:w-64">
           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              placeholder="ค้นหารายวิชา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-sm"
            />
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-semibold shadow-sm ${message.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:col-span-1 h-fit">
          <h2 className="text-base font-bold text-gray-800 mb-4 border-b pb-2">เพิ่มวิชาใหม่</h2>
          <form onSubmit={handleAddSubject} className="space-y-3">
            <input 
              type="text" 
              placeholder="เช่น คณิตศาสตร์, ภาษาอังกฤษ" 
              value={newSubject} 
              onChange={(e) => setNewSubject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              required 
            />
            <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition text-sm disabled:opacity-50">
              {saving ? 'กำลังบันทึก...' : '+ เพิ่มวิชา'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:col-span-2 flex flex-col">
          <h2 className="text-base font-bold text-gray-800 mb-4 border-b pb-2">รายวิชาในระบบ</h2>
          
          <div className="flex-1">
            {loading ? (
              <div className="p-10 text-center text-gray-500 animate-pulse">กำลังโหลดข้อมูล...</div>
            ) : subjects.length === 0 ? (
              <p className="text-gray-400 text-center py-4">{searchTerm ? 'ไม่พบวิชาที่ค้นหา' : 'ยังไม่มีวิชาในระบบ'}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {subjects.map(sub => (
                  <div key={sub.id} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-300 transition">
                    <span className="font-semibold text-gray-700 text-sm">{sub.subject_name}</span>
                    <button onClick={() => handleDelete(sub.id)} className="text-red-400 hover:text-red-600 p-1 bg-white rounded shadow-sm border border-gray-100">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 🔴 5. แทรก UI แถบ Pagination */}
          {subjects.length > 0 && (
             <div className="flex justify-center items-center p-4 border-t border-gray-100 space-x-6 mt-auto">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1}
                className="p-1.5 bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="text-xs font-semibold text-gray-700 bg-gray-50 px-3 py-1 rounded-lg border border-gray-200">
                หน้า {currentPage} / {totalPages}
              </div>

              <button 
                onClick={() => setCurrentPage(p => p + 1)} 
                disabled={currentPage === totalPages}
                className="p-1.5 bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}