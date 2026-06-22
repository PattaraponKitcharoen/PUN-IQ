import { useState } from 'react';
// 🔴 1. นำเข้าเครื่องมือจัดการ Route
import { Routes, Route, Navigate } from 'react-router-dom'; 
import TutorSidebar from './TutorSidebar';
import TimeLog from './tabs/TimeLog';
import TutorBilling from './tabs/TutorBilling';
import HistoryLog from './tabs/HistoryLog';
// 🔴 2. อย่าลืมนำเข้าหน้า Edit ด้วย
import EditTimeLog from './tabs/EditTimeLog'; 

export default function TutorLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center md:hidden shadow-sm">
        <h1 className="text-lg font-bold text-indigo-900">Tutor Portal</h1>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </div>

      {/* 🔴 3. ถอด props เรื่อง activeTab ออก เพราะเดี๋ยว Sidebar จะเช็คจาก URL เอง */}
      <TutorSidebar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
      />

      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-h-screen">
        {/* 🔴 4. เปลี่ยนมาใช้ Routes ควบคุมหน้าแทน switch case */}
        <Routes>
          <Route path="/" element={<Navigate to="timelog" replace />} />
          <Route path="timelog" element={<TimeLog />} />
          <Route path="history" element={<HistoryLog />} />
          <Route path="billing" element={<TutorBilling />} />
          <Route path="edit-log" element={<EditTimeLog />} />
        </Routes>
      </main>
    </div>
  );
}