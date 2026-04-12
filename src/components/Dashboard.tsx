'use client';

import { Search, Lock, Plus } from 'lucide-react';
import { useState } from 'react';

interface BusinessCard {
  id: string;
  name: string;
  company: string;
  title: string;
  email: string;
}

// Mock business card data
const MOCK_CARDS: BusinessCard[] = [
  {
    id: '1',
    name: '山田太郎',
    company: 'TechVision',
    title: 'CTO',
    email: 'yamada@techvision.jp',
  },
  {
    id: '2',
    name: '佐藤花子',
    company: 'GreenLeaf Cafe',
    title: 'Owner',
    email: 'satoh@greenleaf.jp',
  },
  {
    id: '3',
    name: '田中次郎',
    company: 'InnovateLab',
    title: 'Product Manager',
    email: 'tanaka@innovatelab.jp',
  },
  {
    id: '4',
    name: '鈴木美咲',
    company: 'DesignStudio',
    title: 'Creative Director',
    email: 'suzuki@designstudio.jp',
  },
];

export function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [cards] = useState<BusinessCard[]>(MOCK_CARDS);

  // Simple search filter
  const filteredCards = cards.filter((card) => {
    const query = searchQuery.toLowerCase();
    return (
      card.name.toLowerCase().includes(query) ||
      card.company.toLowerCase().includes(query) ||
      card.email.toLowerCase().includes(query)
    );
  });

  const handleScanCard = () => {
    alert('📸 カメラを起動しています...\n(スキャン機能は Phase 1-2 で実装予定)');
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="名前、企業、メールを検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-4 pr-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>

      {/* Results Count */}
      <p className="text-xs text-slate-500">
        {filteredCards.length} 件のカード
      </p>

      {/* Business Cards List */}
      <div className="space-y-3">
        {filteredCards.length > 0 ? (
          filteredCards.map((card) => (
            <div
              key={card.id}
              className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow hover:border-emerald-300"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-sm text-slate-900">{card.name}</p>
                  <p className="text-xs text-slate-600">{card.company}</p>
                </div>
                <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  <span className="text-xs text-emerald-700 font-medium">E2EE</span>
                </div>
              </div>

              {/* Card Details */}
              <div className="space-y-1 text-xs text-slate-600">
                <p>📌 {card.title}</p>
                <p>📧 {card.email}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500">
              検索条件に合うカードが見つかりません
            </p>
          </div>
        )}
      </div>

      {/* Floating Action Button - Sticky */}
      <button
        onClick={handleScanCard}
        className="fixed bottom-8 right-8 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
        title="名刺をスキャン"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
