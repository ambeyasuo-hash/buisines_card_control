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
          className="ambe-input"
        />
        <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 ambe-icon-md text-slate-400 pointer-events-none" />
      </div>

      {/* Results Count */}
      <p className="ambe-text-muted">
        {filteredCards.length} 件のカード
      </p>

      {/* Business Cards List */}
      <div className="space-y-3">
        {filteredCards.length > 0 ? (
          filteredCards.map((card) => (
            <div
              key={card.id}
              className="ambe-card p-4"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-sm text-slate-900">{card.name}</p>
                  <p className="ambe-text-secondary text-xs">{card.company}</p>
                </div>
                <div className="ambe-badge-accent">
                  <Lock className="ambe-icon-sm" />
                  <span>E2EE</span>
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
            <p className="ambe-text-secondary">
              検索条件に合うカードが見つかりません
            </p>
          </div>
        )}
      </div>

      {/* Floating Action Button - Sticky */}
      <button
        onClick={handleScanCard}
        className="fixed bottom-8 right-8 ambe-button-accent rounded-full w-14 h-14 p-0 shadow-lg hover:shadow-xl"
        title="名刺をスキャン"
      >
        <Plus className="ambe-icon-lg" />
      </button>
    </div>
  );
}
