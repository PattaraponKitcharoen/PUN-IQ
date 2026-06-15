import { supabase } from '../../lib/supabase';

export default function TutorSidebar({ activeTab, setActiveTab, isSidebarOpen, setIsSidebarOpen }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const menuItems = [
    { id: 'timelog', label: 'ลงเวลาสอน', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    { id: 'billing', label: 'สรุปรายได้ / บิล', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
  ];

  return (
    <>
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-indigo-900 text-white p-5 flex flex-col justify-between transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div>
          <div className="flex items-center space-x-3 px-2 py-4 mb-6 border-b border-indigo-800">
            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-black text-white border-2 border-indigo-300">T</div>
            <div>
              <span className="block text-lg font-bold tracking-wider leading-none">Tutor Portal</span>
              <span className="block text-xs text-indigo-300 mt-1">PUN-IQ System</span>
            </div>
          </div>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">{item.icon}</svg>
                <span>{item.label}</span>
              </button>
            ))}
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