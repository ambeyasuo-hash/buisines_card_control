'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { NEWS_ITEMS } from '@/lib/news-data';
import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';

export function NewsTicker() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    // Rotate news every 8 seconds
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % NEWS_ITEMS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const currentNews = NEWS_ITEMS[currentIndex];

  const typeColors: Record<string, { bg: string; text: string; border: string }> = {
    feature: {
      bg: 'rgba(16,185,129,0.12)',
      text: '#a7f3d0',
      border: 'rgba(16,185,129,0.30)',
    },
    fix: {
      bg: 'rgba(34,197,94,0.12)',
      text: '#86efac',
      border: 'rgba(34,197,94,0.30)',
    },
    improvement: {
      bg: 'rgba(37,99,235,0.12)',
      text: '#bfdbfe',
      border: 'rgba(59,130,246,0.30)',
    },
    security: {
      bg: 'rgba(139,92,246,0.12)',
      text: '#ddd6fe',
      border: 'rgba(139,92,246,0.30)',
    },
  };

  const colors = typeColors[currentNews.type] || typeColors.feature;

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => router.push('/news')}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full rounded-xl p-3 mb-4 cursor-pointer text-left group relative overflow-hidden"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        boxShadow: `0 4px 12px rgba(37,99,235,0.08), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {/* Animated background gradient */}
      <motion.div
        animate={{ x: ['0%', '100%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${colors.text}20, transparent)`,
          width: '200%',
        }}
      />

      <div className="relative flex items-center gap-2.5">
        {/* Icon */}
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-lg w-7 h-7"
          style={{
            background: `${colors.text}20`,
            color: colors.text,
          }}
        >
          <Zap className="w-4 h-4" strokeWidth={2.5} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                background: colors.text + '15',
                color: colors.text,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {currentNews.version || 'News'}
            </span>
            {currentNews.type === 'security' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                🔒 Secure
              </span>
            )}
          </div>
          <p
            className="text-sm font-medium leading-tight truncate"
            style={{ color: 'rgba(255,255,255,0.90)' }}
          >
            {currentNews.title}
          </p>
        </div>

        {/* Indicator dots */}
        <div className="flex-shrink-0 flex gap-1">
          {NEWS_ITEMS.slice(0, 3).map((_, idx) => (
            <motion.div
              key={idx}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: idx === currentIndex ? colors.text : 'rgba(255,255,255,0.20)',
              }}
              animate={{ scale: idx === currentIndex ? 1.2 : 1 }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-[11px] mt-1.5 pl-9" style={{ color: 'rgba(255,255,255,0.40)' }}>
        {new Date(currentNews.date).toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </div>
    </motion.button>
  );
}
