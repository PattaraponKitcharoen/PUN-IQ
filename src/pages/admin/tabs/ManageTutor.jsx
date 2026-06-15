import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import AddTutorModal from '../modals/AddTutorModal';
import EditTutorInfoModal from '../modals/EditTutorInfoModal';
import ConfirmResetPasswordModal from '../modals/ConfirmResetPasswordModal';
import TutorLogModal from '../modals/TutorLogModal';

export default function ManageTutor() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [showEditPasswordModal, setShowEditPasswordModal] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState(null);

  const [showLogModal, setShowLogModal] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const debounceRef = useRef(null);

  const handleOpenLog = (tutor) => {
    setSelectedTutor(tutor);
    setShowLogModal(true);
  };  

  const fetchTutors = async () => {
    setLoading(true);
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from('users')
      .select('id, name, username, phone, email', { count: 'exact' })
      .eq('role', 'tutor');

    // 🔴 1. สร้างฟังก์ชันล้างอักขระพิเศษที่อาจเป็นอันตราย
    const sanitizeSearch = (term) => {
      return term.replace(/[%_(),.*!]/g, '');
    };

    if (searchTerm) {
      // 🔴 2. ทำความสะอาดข้อความก่อนนำไปใช้งาน
      const safeTerm = sanitizeSearch(searchTerm);
      if (safeTerm.length > 0) {
        query = query.or(`username.ilike.%${safeTerm}%,name.ilike.%${safeTerm}%`);
      }
    }

    const { data, count, error } = await query
      .order('username', { ascending: sortOrder === 'asc' })
      .range(from, to);

    if (!error && data) {
      setTutors(data);
      setTotalPages(Math.ceil(count / ITEMS_PER_PAGE) || 1);
    }
    setLoading(false);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    const delay = searchTerm === '' ? 0 : 500;
    debounceRef.current = setTimeout(() => {
      fetchTutors();
    }, delay);

    return () => clearTimeout(debounceRef.current);
  }, [currentPage, searchTerm, sortOrder]);

  const handleCloseModal = () => {
    setShowAddModal(false);
    fetchTutors(); 
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleOpenEditInfo = (tutor) => {
    setSelectedTutor(tutor);
    setShowEditInfoModal(true);
  };

  const handleOpenEditPassword = (tutor) => {
    setSelectedTutor(tutor);
    setShowEditPasswordModal(true);
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">ระบบจัดการคุณครู</h1>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือ Username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
          </div>
          <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition flex items-center justify-center space-x-2 whitespace-nowrap">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            <span>เพิ่มคุณครูใหม่</span>
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-12 text-center text-gray-500 animate-pulse">กำลังโหลดข้อมูลรายชื่อคุณครู...</div>
        ) : tutors.length === 0 ? ( // 🔴 ปรับปรุง: เปลี่ยนมาตรวจสอบจากข้อมูลจริง (tutors) ตรงๆ
          <div className="p-12 text-center text-gray-400 border-dashed border-gray-300">{searchTerm ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีข้อมูลคุณครูในระบบ'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm uppercase tracking-wider">
                  <th className="p-4 font-semibold">ชื่อ - นามสกุล</th>
                  <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100 transition select-none group" onClick={toggleSortOrder}>
                    <div className="flex items-center space-x-1">
                      <span>ชื่อผู้ใช้งาน</span>
                      <span className="text-gray-400 group-hover:text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    </div>
                  </th>
                  <th className="p-4 font-semibold">อีเมล</th>
                  <th className="p-4 font-semibold text-center w-40">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tutors.map((tutor) => (
                  <tr key={tutor.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-gray-800 font-medium">{tutor.name || '-'}</td>
                    <td className="p-4 text-gray-600">{tutor.username}</td>
                    <td className="p-4 text-gray-600">{tutor.email}</td>
                    <td className="p-4 flex items-center justify-center space-x-2">
                      <button onClick={() => handleOpenEditInfo(tutor)} title="แก้ไขข้อมูล" className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => handleOpenEditPassword(tutor)} title="เปลี่ยนรหัสผ่าน" className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                      </button>
                      <button 
                        onClick={() => handleOpenLog(tutor)}
                        title="ดูประวัติการสอน"
                        className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="flex justify-center items-center p-4 border-t border-gray-200 space-x-6 bg-gray-50/30">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1}
                className="p-2 bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                title="หน้าก่อนหน้า"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="text-sm font-semibold text-gray-700 bg-white px-4 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                หน้า {currentPage} <span className="text-gray-400 font-normal mx-1">จาก</span> {totalPages}
              </div>

              <button 
                onClick={() => setCurrentPage(p => p + 1)} 
                disabled={currentPage === totalPages}
                className="p-2 bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                title="หน้าถัดไป"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

          </div>
        )}
      </div>

      <AddTutorModal isOpen={showAddModal} onClose={handleCloseModal} />

      <EditTutorInfoModal 
        isOpen={showEditInfoModal} 
        onClose={() => setShowEditInfoModal(false)} 
        tutor={selectedTutor}
        onSuccess={fetchTutors} 
      />

      <ConfirmResetPasswordModal 
        isOpen={showEditPasswordModal} 
        onClose={() => setShowEditPasswordModal(false)} 
        tutor={selectedTutor}
      />

      <TutorLogModal 
        isOpen={showLogModal} 
        onClose={() => setShowLogModal(false)} 
        tutor={selectedTutor} 
      />

    </div>
  );
}