import { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import Dashboard from './tabs/Dashboard';
import ManageTutor from './tabs/ManageTutor';
import ManageStudent from './tabs/ManageStudent';
import ManageGroup from './tabs/ManageGroup';
import ManageCourse from './tabs/ManageCourse';
import ManagePrice from './tabs/ManagePrice';
import ManageSubject from './tabs/ManageSubject';
import ManageCustomCourse from './tabs/ManageCustomCourse';
import ManageCompanyAccount from './tabs/ManageCompanyAccount';
import Billing from './tabs/Billing';
import ReserveRoom from './tabs/ReserveRoom'; // 🔴 1. Import หน้า Reserve Room

export default function AdminLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'tutors': return <ManageTutor />;
      case 'students': return <ManageStudent />;
      case 'groups': return <ManageGroup />;
      case 'courses': return <ManageCourse />;
      case 'prices': return <ManagePrice />;
      case 'subjects': return <ManageSubject />;
      case 'custom-courses': return <ManageCustomCourse />;
      case 'company': return <ManageCompanyAccount />;
      case 'billing': return <Billing />;
      case 'reserve-room': return <ReserveRoom />; // 🔴 2. เพิ่ม Case สำหรับเมนูเช่าห้อง
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row font-sans">
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center md:hidden shadow-sm">
        <h1 className="text-lg font-bold text-gray-800">Admin Panel</h1>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </div>

      <AdminSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
      />

      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-h-screen">
        {renderContent()}
      </main>
    </div>
  );
}