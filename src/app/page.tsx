'use client';

import { useState } from 'react';
import { IdentityPage } from '@/components/IdentityPage';
import { Dashboard } from '@/components/Dashboard';
import { ElegantRescue } from '@/components/ElegantRescue';
import { QrCode, FolderOpen, Settings, ChevronRight } from 'lucide-react';

type ActiveTab = 'dashboard' | 'identity' | 'rescue';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const actionCards = [
    {
      id: 'identity',
      label: '名刺をスキャン',
      description: 'QRコードで接続',
      icon: QrCode,
      bgGradient: 'from-blue-500/30 to-blue-600/30',
      borderColor: 'border-blue-400/30',
      iconColor: 'text-blue-300',
    },
    {
      id: 'dashboard',
      label: '名刺一覧',
      description: 'コレクションを見る',
      icon: FolderOpen,
      bgGradient: 'from-emerald-500/30 to-emerald-600/30',
      borderColor: 'border-emerald-400/30',
      iconColor: 'text-emerald-300',
    },
    {
      id: 'rescue',
      label: '設定',
      description: '環境設定を管理',
      icon: Settings,
      bgGradient: 'from-purple-500/30 to-purple-600/30',
      borderColor: 'border-purple-400/30',
      iconColor: 'text-purple-300',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Dashboard View */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Greeting */}
          <div className="text-center mb-8">
            <p className="text-white/80 text-sm">ようこそ</p>
            <h2 className="text-2xl font-semibold text-white mt-1">
              何をしますか？
            </h2>
          </div>

          {/* Action Cards Grid */}
          <div className="space-y-4">
            {actionCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.id}
                  onClick={() => setActiveTab(card.id as ActiveTab)}
                  className={`w-full group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-98
                    bg-gradient-to-br ${card.bgGradient} ${card.borderColor} border border-white/10
                    hover:border-white/30 hover:bg-gradient-to-br hover:from-blue-500/40 hover:to-emerald-500/40 backdrop-blur-sm`}
                >
                  {/* Shine Effect on Hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 blur-xl"></div>
                  </div>

                  {/* Content */}
                  <div className="relative px-6 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className="p-3 rounded-xl bg-white/10 group-hover:bg-white/20 transition-colors">
                        <Icon className={`w-8 h-8 ${card.iconColor}`} />
                      </div>

                      {/* Text */}
                      <div className="text-left">
                        <p className="font-semibold text-white text-lg">
                          {card.label}
                        </p>
                        <p className="text-white/60 text-sm">
                          {card.description}
                        </p>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-6 h-6 text-white/40 group-hover:text-white/80 transition-colors group-hover:translate-x-1 duration-300" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Status Indicator */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <p className="text-xs text-white/50">
                システム正常・準備完了
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Identity Page */}
      {activeTab === 'identity' && (
        <div>
          <button
            onClick={() => setActiveTab('dashboard')}
            className="mb-4 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            戻る
          </button>
          <IdentityPage />
        </div>
      )}

      {/* Dashboard Cards */}
      {activeTab === 'dashboard' && false && (
        <div>
          <button
            onClick={() => setActiveTab('dashboard')}
            className="mb-4 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            戻る
          </button>
          <Dashboard />
        </div>
      )}

      {/* Rescue Page */}
      {activeTab === 'rescue' && (
        <div>
          <button
            onClick={() => setActiveTab('dashboard')}
            className="mb-4 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            戻る
          </button>
          <ElegantRescue />
        </div>
      )}
    </div>
  );
}
