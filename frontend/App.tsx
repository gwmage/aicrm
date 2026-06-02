
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import CustomerManagement from './views/CustomerManagement';
import EmailComposer from './views/EmailComposer';
import EmailManagement from './views/EmailManagement';
import { View, Customer } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.CUSTOMERS);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCurrentView(View.COMPOSE);
  };

  const renderContent = () => {
    switch (currentView) {
      case View.CUSTOMERS:
        return <CustomerManagement onSelectCustomer={handleSelectCustomer} />;
      case View.COMPOSE:
        return selectedCustomer ? (
          <EmailComposer customer={selectedCustomer} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-10 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="size-20 bg-gray-100 rounded-3xl flex items-center justify-center text-gray-300 mb-6">
              <span className="material-symbols-outlined text-5xl">person_search</span>
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">선택된 고객이 없습니다</h2>
            <p className="text-gray-500 font-medium mb-8 max-w-sm">메일을 작성하려면 먼저 고객 관리 메뉴에서 작성 대상을 선택해주세요.</p>
            <button 
              onClick={() => setCurrentView(View.CUSTOMERS)}
              className="bg-primary text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-primary/20 hover:scale-105 transition-all"
            >
              고객 리스트 바로가기
            </button>
          </div>
        );
      case View.SCHEDULE:
        return <EmailManagement />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background-light overflow-hidden selection:bg-primary/20">
      <Sidebar 
        currentView={currentView} 
        onNavigate={(view) => {
          setCurrentView(view);
          if (view !== View.COMPOSE) setSelectedCustomer(null);
        }} 
      />
      
      <main className="flex-1 overflow-y-auto relative">
        {/* Subtle decorative background element */}
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-primary/5 blur-[120px] pointer-events-none -z-10"></div>
        <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-indigo-500/5 blur-[120px] pointer-events-none -z-10"></div>
        
        <header className="h-16 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md border-b border-[#dbdfe6] sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-lg">auto_awesome</span>
            </div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
              {currentView === View.CUSTOMERS && "Customer Workspace"}
              {currentView === View.COMPOSE && "AI Drafting Engine"}
              {currentView === View.SCHEDULE && "Delivery Insights"}
            </p>
          </div>
        </header>

        {renderContent()}

        <footer className="py-10 px-10 text-center border-t border-gray-100 bg-white/50">
          <p className="text-[10px] text-[#616f89] font-black uppercase tracking-[0.2em] opacity-60">
            © 2024 CRM AUTOMATE PRO. ALL RIGHTS RESERVED.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default App;
