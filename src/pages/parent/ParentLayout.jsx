import { useState } from 'react';
import ParentSidebar from './ParentSidebar';
import ParentDashboard from './tabs/ParentDashboard';
import ParentBilling from './tabs/ParentBilling';

export default function ParentLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <ParentDashboard />;
      case 'billing': return <ParentBilling />;
      default: return <ParentDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center md:hidden shadow-sm sticky top-0 z-20">
        <div className="flex items-center space-x-2">
           <img src="/logo.svg" alt="PUN-IQ" className="w-8 h-8 bg-indigo-100 rounded p-1" />
           <h1 className="text-lg font-bold text-indigo-900">Parent Portal</h1>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </div>

      <ParentSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
      />

      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-screen w-full">
        {renderContent()}
      </main>
    </div>
  );
}