'use client';

import { useState } from 'react';
import { IdentityPage } from '@/components/IdentityPage';
import { Dashboard } from '@/components/Dashboard';
import { ElegantRescue } from '@/components/ElegantRescue';
import { Camera, List, Settings, ChevronLeft } from 'lucide-react';

type ActiveTab = 'dashboard' | 'identity' | 'list' | 'rescue';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const actionCards = [
    {
      id: 'identity',
      label: '名刺をスキャン',
      sublabel: 'カメラで撮影してAI解析',
      icon: Camera,
      bgFrom: 'from-blue-600/40',
      bgTo: 'to-blue-500/20',
      borderColor: 'border-blue-400/30',
      iconColor: 'text-blue-300',
      iconBg: 'bg-blue-500/20',
      hoverBg: 'hover:from-blue-600/50 hover:to-blue-500/30',
    },
    {
      id: 'list',
      label: '名刺一覧',
      sublabel: '保存済みの名刺を確認',
      icon: List,
      bgFrom: 'from-emerald-600/40',
      bgTo: 'to-emerald-500/20',
      borderColor: 'border-emerald-400/30',
      iconColor: 'text-emerald-300',
      iconBg: 'bg-emerald-500/20',
      hoverBg: 'hover:from-emerald-600/50 hover:to-emerald-500/30',
    },
    {
      id: 'rescue',
      label: '設定',
      sublabel: 'APIキーとプロフィール',
      icon: Settings,
      bgFrom: 'from-purple-600/40',
      bgTo: 'to-purple-500/20',
      borderColor: 'border-purple-400/30',
      iconColor: 'text-purple-300',
      iconBg: 'bg-purple-500/20',
      hoverBg: 'hover:from-purple-600/50 hover:to-purple-500/30',
    },
  ];

  return (
    <div className="w-full">
      {/* Dashboard View */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-white">ダッシュボード</h2>
            <p className="text-white/60 text-sm">
              現場での出会いを最速でお礼メールと音声に変える
            </p>
          </div>

          {/* Action Cards */}
          <div className="space-y-4">
            {actionCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.id}
                  onClick={() => setActiveTab(card.id as ActiveTab)}
                  className={`w-full group relative overflow-hidden rounded-2xl border backdrop-blur-sm transition-all duration-300
                    bg-gradient-to-br ${card.bgFrom} ${card.bgTo} ${card.borderColor}
                    border border-white/10 hover:border-white/30 ${card.hoverBg}
                    hover:shadow-2xl hover:shadow-white/10 active:scale-95`}
                >
                  {/* Animated Gradient Background */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10 blur-2xl"></div>
                  </div>

                  {/* Content - Centered Layout */}
                  <div className="relative px-6 py-8 flex flex-col items-center justify-center text-center space-y-4">
                    {/* Icon Container */}
                    <div className={`p-4 rounded-2xl ${card.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`w-10 h-10 ${card.iconColor}`} strokeWidth={1.5} />
                    </div>

                    {/* Text */}
                    <div className="space-y-1">
                      <p className="font-semibold text-white text-lg leading-tight">
                        {card.label}
                      </p>
                      <p className="text-white/50 text-xs leading-snug">
                        {card.sublabel}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Accent Line */}
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
              );
            })}
          </div>

          {/* Status Bar */}
          <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <p className="text-xs text-white/50">システム正常・準備完了</p>
          </div>
        </div>
      )}

      {/* Identity Page (Scan) */}
      {activeTab === 'identity' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white/70" />
            </button>
            <h2 className="text-xl font-semibold text-white">名刺をスキャン</h2>
          </div>
          <IdentityPage />
        </div>
      )}

      {/* Dashboard List */}
      {activeTab === 'list' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white/70" />
            </button>
            <h2 className="text-xl font-semibold text-white">名刺一覧</h2>
          </div>
          <Dashboard />
        </div>
      )}

      {/* Settings Page */}
      {activeTab === 'rescue' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white/70" />
            </button>
            <h2 className="text-xl font-semibold text-white">設定</h2>
          </div>
          <ElegantRescue />
        </div>
      )}
    </div>
  );
}
