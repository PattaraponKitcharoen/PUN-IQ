import { supabase } from '../../lib/supabase';
// 🔴 1. นำเข้าเครื่องมือตรวจสอบ URL
import { useNavigate, useLocation } from 'react-router-dom';

export default function TutorSidebar({ isSidebarOpen, setIsSidebarOpen }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // 🔴 2. เพิ่มแท็บประวัติ พร้อมปรับไอคอนให้สื่อความหมายชัดเจนขึ้น
  const menuItems = [
    { id: 'timelog', path: '/tutor/timelog', label: 'ลงเวลา', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /> }, // ไอคอน + (บวก)
    { id: 'history', path: '/tutor/history', label: 'ประวัติการลงเวลา', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> }, // ไอคอน นาฬิกา
    { id: 'billing', path: '/tutor/billing', label: 'สรุปรายได้ / บิล', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
  ];

  return (
    <>
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-indigo-900 text-white p-5 flex flex-col justify-between transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div>
          {/* 🔴 ส่วนที่ปรับปรุง: นำโลโก้ logo.svg มาใส่แทนตัว T และจัด Layout ให้เหมือนหน้า Admin */}
          <div className="flex items-center space-x-3 px-1 py-4 mb-6 border-b border-indigo-800">
            <img 
              src="/logo.svg" 
              alt="PUN-IQ Logo" 
              className="w-14 h-14 object-contain rounded-xl bg-white/10 p-1 shadow-sm shrink-0" 
            />
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-bold tracking-wide leading-tight whitespace-nowrap">Tutor Portal</span>
              <span className="text-xs font-medium text-indigo-300 mt-0.5 whitespace-nowrap">PUN-IQ System</span>
            </div>
          </div>
          
          <nav className="space-y-1">
            {menuItems.map((item) => {
              // 🔴 3. ลอจิกสำคัญ: ไฮไลต์สีน้ำเงิน ถ้า URL ตรงกับ Path หรือ ถ้าอยู่หน้า edit-log ก็ให้ไฮไลต์แท็บ history ค้างไว้!
              const isActive = location.pathname.includes(item.path) || (item.id === 'history' && location.pathname.includes('/edit-log'));
              
              return (
                <button 
                  key={item.id} 
                  onClick={() => { 
                    navigate(item.path); 
                    setIsSidebarOpen(false); 
                  }} 
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">{item.icon}</svg>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium text-red-300 hover:bg-red-900/50 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>ออกจากระบบ</span>
        </button>
      </aside>
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-30 md:hidden" />}
    </>
  );
}