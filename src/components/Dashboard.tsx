'use client';

import { Search, Plus, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tokenizeForSearch, normalizePersonName } from '@/lib/normalize';

type Industry = 'IT' | '飲食' | '建設' | '製造' | '金融' | 'その他';
type SortType = 'recent' | 'name';

interface BusinessCard {
  id: string;
  name: string;
  company: string;
  title: string;
  email: string;
  industry: Industry;
  registeredAt: Date;
}

const INDUSTRIES: Industry[] = ['IT', '飲食', '建設', '製造', '金融', 'その他'];

const MOCK_CARDS: BusinessCard[] = [
  {
    id: '1',
    name: '山田太郎',
    company: 'TechVision',
    title: 'CTO',
    email: 'yamada@techvision.jp',
    industry: 'IT',
    registeredAt: new Date('2026-04-10'),
  },
  {
    id: '2',
    name: '佐藤花子',
    company: 'GreenLeaf Cafe',
    title: 'Owner',
    email: 'satoh@greenleaf.jp',
    industry: '飲食',
    registeredAt: new Date('2026-04-08'),
  },
  {
    id: '3',
    name: '田中次郎',
    company: 'InnovateLab',
    title: 'Product Manager',
    email: 'tanaka@innovatelab.jp',
    industry: 'IT',
    registeredAt: new Date('2026-04-09'),
  },
  {
    id: '4',
    name: '鈴木美咲',
    company: 'DesignStudio',
    title: 'Creative Director',
    email: 'suzuki@designstudio.jp',
    industry: 'IT',
    registeredAt: new Date('2026-04-07'),
  },
  {
    id: '5',
    name: '阿部健太',
    company: 'BuildCorp',
    title: '営業部長',
    email: 'abe@buildcorp.jp',
    industry: '建設',
    registeredAt: new Date('2026-04-06'),
  },
  {
    id: '6',
    name: '加藤由美',
    company: 'ManufacturePro',
    title: 'QA Lead',
    email: 'kato@mfgpro.jp',
    industry: '製造',
    registeredAt: new Date('2026-04-05'),
  },
  {
    id: '7',
    name: '中村智也',
    company: 'FinanceWorks',
    title: 'Senior Analyst',
    email: 'nakamura@financeworks.jp',
    industry: '金融',
    registeredAt: new Date('2026-04-04'),
  },
  {
    id: '8',
    name: '伊藤麻衣',
    company: 'Ramen Yokocho',
    title: '店長',
    email: 'ito@ramen-yokocho.jp',
    industry: '飲食',
    registeredAt: new Date('2026-04-03'),
  },
  {
    id: '9',
    name: '小林次朗',
    company: 'TechStartup Inc',
    title: 'Engineering Manager',
    email: 'kobayashi@techstartup.jp',
    industry: 'IT',
    registeredAt: new Date('2026-04-02'),
  },
  {
    id: '10',
    name: '野田由紀子',
    company: 'DynamicsInc',
    title: 'Consultant',
    email: 'noda@dynamics.jp',
    industry: 'その他',
    registeredAt: new Date('2026-04-01'),
  },
];

// Color palette by index % 3 — enhanced contrast for mobile
const CARD_COLORS = [
  {
    bg: 'rgba(37,99,235,0.18)',
    border: 'rgba(59,130,246,0.35)',
    accent: 'rgba(59,130,246,0.60)',
    accentText: '#bfdbfe',
    badgeBg: 'rgba(37,99,235,0.28)',
    badgeBorder: 'rgba(59,130,246,0.50)',
    badgeText: '#dbeafe',
    dot: '#3b82f6',
  },
  {
    bg: 'rgba(16,185,129,0.16)',
    border: 'rgba(16,185,129,0.35)',
    accent: 'rgba(16,185,129,0.58)',
    accentText: '#86efac',
    badgeBg: 'rgba(16,185,129,0.28)',
    badgeBorder: 'rgba(52,211,153,0.50)',
    badgeText: '#bbf7d0',
    dot: '#10b981',
  },
  {
    bg: 'rgba(139,92,246,0.18)',
    border: 'rgba(139,92,246,0.35)',
    accent: 'rgba(139,92,246,0.58)',
    accentText: '#ddd6fe',
    badgeBg: 'rgba(139,92,246,0.28)',
    badgeBorder: 'rgba(167,139,250,0.50)',
    badgeText: '#ede9fe',
    dot: '#8b5cf6',
  },
];

export function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustries, setSelectedIndustries] = useState<Set<Industry>>(new Set());
  const [sortType, setSortType] = useState<SortType>('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [cards] = useState<BusinessCard[]>(MOCK_CARDS);

  // Memoized filtering & sorting
  const processedCards = useMemo(() => {
    let result = [...cards];

    // 1. テキスト検索：日本語・英数字で直接マッチング
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase();

      result = result.filter((card) => {
        // 日本語フルテキスト検索
        if (
          card.name.includes(searchQuery) ||
          card.company.includes(searchQuery) ||
          card.title.includes(searchQuery)
        ) {
          return true;
        }

        // 英数字検索（小文字で正規化）
        if (
          card.name.toLowerCase().includes(queryLower) ||
          card.company.toLowerCase().includes(queryLower) ||
          card.email.toLowerCase().includes(queryLower) ||
          card.title.toLowerCase().includes(queryLower)
        ) {
          return true;
        }

        return false;
      });
    }

    // 2. 業種フィルタリング
    if (selectedIndustries.size > 0) {
      result = result.filter((card) => selectedIndustries.has(card.industry));
    }

    // 3. ソート
    if (sortType === 'recent') {
      result.sort((a, b) => b.registeredAt.getTime() - a.registeredAt.getTime());
    } else if (sortType === 'name') {
      // 日本語の五十音順でソート
      result.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    }

    return result;
  }, [cards, searchQuery, selectedIndustries, sortType]);

  const toggleIndustry = (industry: Industry) => {
    const newSet = new Set(selectedIndustries);
    if (newSet.has(industry)) {
      newSet.delete(industry);
    } else {
      newSet.add(industry);
    }
    setSelectedIndustries(newSet);
  };

  return (
    <div className="space-y-4 pb-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-lg p-4">

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="名前、企業、メールを検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '12px',
            padding: '10px 44px 10px 14px',
            color: 'rgba(255,255,255,0.85)',
            fontSize: '13px',
            outline: 'none',
            backdropFilter: 'blur(8px)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = '1px solid rgba(59,130,246,0.45)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <Search
          style={{
            position: 'absolute',
            right: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '16px',
            height: '16px',
            color: 'rgba(255,255,255,0.28)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Industry Filter Chips */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
      >
        {INDUSTRIES.map((industry) => {
          const isSelected = selectedIndustries.has(industry);
          const gradients = [
            'from-blue-500/30 to-cyan-500/10',
            'from-emerald-500/30 to-teal-500/10',
            'from-purple-500/30 to-pink-500/10',
          ];
          const idx = INDUSTRIES.indexOf(industry);
          const gradient = gradients[idx % 3];

          return (
            <motion.button
              key={industry}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleIndustry(industry)}
              style={{
                background: isSelected
                  ? `linear-gradient(135deg, ${gradient.split(' ')[1].replace('/', ' 30%) ').slice(0, -1)}30%)`
                  : 'rgba(255,255,255,0.04)',
                border: isSelected
                  ? `1px solid rgba(59,130,246,0.40)`
                  : '1px solid rgba(255,255,255,0.10)',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '12px',
                color: isSelected ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.50)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {industry}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Filter & Sort Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', letterSpacing: '0.3px' }}>
          {processedCards.length} 件のカード
        </p>

        {/* Sort Dropdown */}
        <div style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSortMenu(!showSortMenu)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.60)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{sortType === 'recent' ? '新しい順' : '名前順'}</span>
            <ChevronDown style={{ width: '14px', height: '14px' }} />
          </motion.button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {showSortMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  background: 'rgba(15,23,42,0.95)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  minWidth: '140px',
                  backdropFilter: 'blur(12px)',
                  zIndex: 50,
                }}
              >
                {(['recent', 'name'] as SortType[]).map((type) => (
                  <motion.button
                    key={type}
                    onClick={() => {
                      setSortType(type);
                      setShowSortMenu(false);
                    }}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: '12px',
                      color:
                        sortType === type
                          ? 'rgba(59,130,246,0.85)'
                          : 'rgba(255,255,255,0.50)',
                      background:
                        sortType === type ? 'rgba(59,130,246,0.12)' : 'transparent',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    {type === 'recent' ? '登録が新しい順' : '名前順（五十音）'}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Business Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <AnimatePresence>
          {processedCards.length > 0 ? (
            processedCards.map((card, i) => {
              const color = CARD_COLORS[i % 3];
              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ delay: i * 0.06, duration: 0.22, ease: 'easeOut' }}
                  whileHover={{ y: -2, scale: 1.01 }}
                  style={{
                    background: color.bg,
                    border: `1px solid ${color.border}`,
                    borderRadius: '14px',
                    padding: '14px 16px',
                    cursor: 'default',
                    transition: 'box-shadow 0.2s ease',
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      {/* Avatar dot */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: color.badgeBg,
                        border: `1px solid ${color.badgeBorder}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <span style={{ fontSize: '13px', color: color.accentText, fontWeight: 600 }}>
                          {card.name[0]}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.90)' }}>
                          {card.name}
                        </p>
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)', marginTop: '1px' }}>
                          {card.company}
                        </p>
                      </div>
                    </div>

                    {/* Industry Badge */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '14px',
                      padding: '3px 8px',
                    }}>
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.50)' }}>
                        {card.industry}
                      </span>
                    </div>
                  </div>

                  {/* Card Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
                      <span style={{ color: color.accentText, marginRight: '6px' }}>▸</span>
                      {card.title}
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)' }}>
                      <span style={{ color: color.accentText, marginRight: '6px' }}>@</span>
                      {card.email}
                    </p>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.28)' }}>
                検索条件に合うカードが見つかりません
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => alert('📸 カメラを起動しています...\n(スキャン機能は Phase 1-2 で実装予定)')}
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          boxShadow: '0 4px 20px rgba(37,99,235,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '1px solid rgba(96,165,250,0.30)',
        }}
        title="名刺をスキャン"
      >
        <Plus style={{ width: '22px', height: '22px', color: '#fff' }} strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}
