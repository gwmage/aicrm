
import React from 'react';
import { View } from '../types';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const navItems = [
    { id: View.CUSTOMERS, icon: 'group', label: '고객 관리' },
    { id: View.COMPOSE, icon: 'auto_awesome', label: 'AI 메일 작성' },
    { id: View.SCHEDULE, icon: 'history_toggle_off', label: '발송 및 예약 관리' },
  ];

  return (
    <aside className="w-64 flex-shrink-0 border-r border-[#dbdfe6] bg-white flex flex-col h-screen sticky top-0">
      <div className="h-16 flex items-center px-6 border-b border-[#dbdfe6]">
        <div className="flex items-center gap-2">
          <div className="size-6 bg-primary rounded flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
          </div>
          <h2 className="text-[#111318] text-sm font-bold tracking-widest uppercase">AI CRM</h2>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              currentView === item.id
                ? 'bg-primary/10 text-primary font-bold shadow-sm'
                : 'text-[#616f89] hover:bg-gray-50 font-medium'
            }`}
          >
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
