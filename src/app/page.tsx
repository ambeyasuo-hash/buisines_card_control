'use client';

import { useState } from 'react';
import { IdentityPage } from '@/components/IdentityPage';
import { Dashboard } from '@/components/Dashboard';
import { ElegantRescue } from '@/components/ElegantRescue';
import { User, FolderOpen, Shield } from 'lucide-react';

type ActiveTab = 'identity' | 'dashboard' | 'rescue';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('identity');

  const tabConfig: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: 'identity', label: 'プロフィール', icon: <User className="ambe-icon-sm" /> },
    { id: 'dashboard', label: 'カード', icon: <FolderOpen className="ambe-icon-sm" /> },
    { id: 'rescue', label: '復旧', icon: <Shield className="ambe-icon-sm" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 ambe-divider pb-0 border-b">
        {tabConfig.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                : 'border-transparent text-slate-600 hover:text-slate-700'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === 'identity' && <IdentityPage />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'rescue' && <ElegantRescue />}
      </div>

      {/* Status Bar */}
      <div className="mt-8 pt-6 ambe-divider text-center text-xs text-slate-500">
        <p className="pt-4">Phase 1-3: Design System Ready</p>
      </div>
    </div>
  );
}
