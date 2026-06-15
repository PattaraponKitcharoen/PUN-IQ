import { useState } from 'react';
import TutorSidebar from './TutorSidebar';
import TimeLog from './tabs/TimeLog';
import TutorBilling from './tabs/TutorBilling';

export default function TutorLayout() {
  const [activeTab, setActiveTab] = useState('timelog');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'timelog': return <TimeLog />;
      case 'billing': return <TutorBilling />;
      default: return <TimeLog />;
    }
  };

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

      <TutorSidebar 
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