import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import AddStudentModal from '../modals/AddStudentModal';
import EditStudentInfoModal from '../modals/EditStudentInfoModal';
import ConfirmResetPasswordModal from '../modals/ConfirmResetPasswordModal'; 
import ConfirmDeleteStudentModal from '../modals/ConfirmDeleteStudentModal';
import EditStudentAccountModal from '../modals/EditStudentAccountModal';

export default function ManageStudent() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [showEditPasswordModal, setShowEditPasswordModal] = useState(false);
  // 🔴 2. เพิ่ม State สำหรับ Modal เลือกบัญชี
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const debounceRef = useRef(null);

  const fetchStudents = async () => {
    setLoading(true);
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from('users')
      // 🔴 3. เพิ่มการดึง company_account_id เพื่อให้ปุ่มใหม่มีข้อมูลตั้งต้นไปแสดง
      .select('id, name, username, grade, phone, email, company_account_id', { count: 'exact' })
      .eq('role', 'student');

    const sanitizeSearch = (term) => {
      return term.replace(/[%_(),.*!]/g, '');
    };

    if (searchTerm) {
      const safeTerm = sanitizeSearch(searchTerm);
      if (safeTerm.length > 0) {
        query = query.or(`username.ilike.%${safeTerm}%,name.ilike.%${safeTerm}%`);
      }
    }

    const { data, count, error } = await query
      .order('username', { ascending: sortOrder === 'asc' })
      .range(from, to);

    if (!error && data) {
      setStudents(data);
      setTotalPages(Math.ceil(count / ITEMS_PER_PAGE) || 1);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    const delay = searchTerm === '' ? 0 : 500;
    debounceRef.current = setTimeout(() => {
      fetchStudents();
    }, delay);

    return () => clearTimeout(debounceRef.current);
  }, [currentPage, searchTerm, sortOrder]);

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    fetchStudents();
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleOpenDelete = (student) => {
    setSelectedStudent(student);
    setShowDeleteModal(true);
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">ระบบจัดการนักเรียน (Manage Students)</h1>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือ Username นักเรียน..."
              value={searchTerm}
              // 🔴 แก้ onChange ให้เซ็ตหน้าปัจจุบันกลับเป็นหน้า 1 ทันทีที่พิมพ์
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
          </div>
          <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition flex items-center justify-center space-x-2 whitespace-nowrap">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            <span>เพิ่มนักเรียนใหม่</span>
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-12 text-center text-gray-500 animate-pulse">กำลังโหลดข้อมูลรายชื่อนักเรียน...</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-gray-400 border-dashed border-gray-300">{searchTerm ? 'ไม่พบข้อมูลนักเรียนที่ค้นหา' : 'ยังไม่มีข้อมูลนักเรียนในระบบ'}</div>
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
                  <th className="p-4 font-semibold">ระดับชั้น</th>
                  <th className="p-4 font-semibold">เบอร์โทรศัพท์</th>
                  <th className="p-4 font-semibold">อีเมล</th>
                  <th className="p-4 font-semibold text-center w-40">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-gray-800 font-medium">{student.name || '-'}</td>
                    <td className="p-4 text-gray-600">{student.username}</td>
                    <td className="p-4 text-gray-700 font-semibold"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs">{student.grade || '-'}</span></td>
                    <td className="p-4 text-gray-600">{student.phone || '-'}</td>
                    <td className="p-4 text-gray-600 text-sm">{student.email}</td>
                    <td className="p-4 flex items-center justify-center space-x-2">
                      <button onClick={() => { setSelectedStudent(student); setShowEditInfoModal(true); }} title="แก้ไขข้อมูล" className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      
                      {/* 🔴 4. เพิ่มปุ่มตั้งค่าบัญชี (สีเขียว) แทรกตรงกลาง */}
                      <button onClick={() => { setSelectedStudent(student); setShowEditAccountModal(true); }} title="ตั้งค่าบัญชีรับเงิน" className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>

                      <button onClick={() => { setSelectedStudent(student); setShowEditPasswordModal(true); }} title="เปลี่ยนรหัสผ่าน" className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                      </button>

                      <button onClick={() => handleOpenDelete(student)} title="ลบข้อมูลนักเรียน" className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

      <AddStudentModal isOpen={showAddModal} onClose={handleCloseAddModal} />
      <EditStudentInfoModal isOpen={showEditInfoModal} onClose={() => setShowEditInfoModal(false)} student={selectedStudent} onSuccess={fetchStudents} />
      <ConfirmResetPasswordModal isOpen={showEditPasswordModal} onClose={() => setShowEditPasswordModal(false)} tutor={selectedStudent} />
      
      {/* 🔴 5. เรียกใช้ Modal ตัวใหม่ */}
      <EditStudentAccountModal isOpen={showEditAccountModal} onClose={() => setShowEditAccountModal(false)} student={selectedStudent} onSuccess={fetchStudents} />
      <ConfirmDeleteStudentModal 
        isOpen={showDeleteModal} 
        onClose={() => setShowDeleteModal(false)} 
        student={selectedStudent} 
        onSuccess={fetchStudents} 
      />
    </div>
  );
}