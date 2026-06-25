import { supabase } from '../../lib/supabase';

export default function ParentSidebar({ activeTab, setActiveTab, isSidebarOpen, setIsSidebarOpen }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('custom_user_session');
    window.location.href = '/login';
  };

  const menuItems = [
    { id: 'dashboard', label: 'ประวัติการเรียน', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /> },
    { id: 'billing', label: 'บิลค่าใช้จ่าย', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" /> },
  ];

  const parentSession = JSON.parse(localStorage.getItem('custom_user_session') || '{}');

  return (
    <>
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-indigo-950 text-white p-5 flex flex-col justify-between transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div>
          <div className="flex items-center space-x-3 px-1 py-4 mb-6 border-b border-indigo-900/50">
            <img src="/logo.svg" alt="PUN-IQ Logo" className="w-12 h-12 object-contain rounded-xl bg-white/10 p-1 shadow-sm shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold tracking-wide whitespace-nowrap">Parent Portal</span>
              <span className="text-[10px] font-medium text-indigo-300 mt-0.5 truncate">PUN-IQ System</span>
            </div>
          </div>
          
          <nav className="space-y-1.5">
            {menuItems.map((item) => (
              <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-300 hover:bg-indigo-900/50 hover:text-white'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">{item.icon}</svg>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors mt-10">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          <span>ออกจากระบบ</span>
        </button>
      </aside>
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-30 md:hidden" />}
    </>
  );
}