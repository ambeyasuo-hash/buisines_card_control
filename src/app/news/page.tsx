'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { NEWS_ITEMS, NewsItem } from '@/lib/news-data';
import { ChevronLeft, Zap, Bug, Sparkles, Lock, ChevronRight } from 'lucide-react';
import { BackButton } from '@/components/BackButton';

export default function NewsPage() {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const typeConfig: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string; border: string }> = {
    feature: {
      icon: <Sparkles className="w-4 h-4" />,
      label: '新機能',
      color: '#a7f3d0',
      bg: 'rgba(16,185,129,0.12)',
      border: 'rgba(16,185,129,0.30)',
    },
    fix: {
      icon: <Bug className="w-4 h-4" />,
      label: 'バグ修正',
      color: '#86efac',
      bg: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.30)',
    },
    improvement: {
      icon: <Zap className="w-4 h-4" />,
      label: '改善',
      color: '#bfdbfe',
      bg: 'rgba(37,99,235,0.12)',
      border: 'rgba(59,130,246,0.30)',
    },
    security: {
      icon: <Lock className="w-4 h-4" />,
      label: 'セキュリティ',
      color: '#ddd6fe',
      bg: 'rgba(139,92,246,0.12)',
      border: 'rgba(139,92,246,0.30)',
    },
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-4 pb-3.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <BackButton onClick={() => router.back()} />
        <h1 className="text-white font-semibold text-[16px]">
          お知らせ
        </h1>
      </div>

      {/* Content */}
      <div className="px-4 pt-5 pb-8">
        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <p style={{ color: 'rgba(255,255,255,0.50)', fontSize: '12px', lineHeight: 1.6 }}>
            「あんべの名刺代わり」の最新のアップデート情報をご覧ください。新機能、セキュリティアップデート、パフォーマンス改善についてお知らせします。
          </p>
        </motion.div>

        {/* News List */}
        <motion.div layout className="flex flex-col gap-3">
          {NEWS_ITEMS.map((item, idx) => {
            const config = typeConfig[item.type] || typeConfig.feature;
            const isExpanded = expandedId === item.id;

            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full text-left rounded-lg p-4 cursor-pointer group transition-all"
                style={{
                  background: config.bg,
                  border: `1px solid ${config.border}`,
                  boxShadow: isExpanded
                    ? `0 8px 16px rgba(37,99,235,0.12), inset 0 1px 0 rgba(255,255,255,0.04)`
                    : `0 2px 6px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04)`,
                }}
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-lg w-8 h-8 mt-0.5"
                    style={{
                      background: config.color + '20',
                      color: config.color,
                    }}
                  >
                    {config.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-bold px-2 py-1 rounded"
                        style={{
                          background: config.color + '15',
                          color: config.color,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {config.label}
                      </span>
                      {item.version && (
                        <span
                          className="text-[10px] font-semibold px-1.5 rounded"
                          style={{ color: 'rgba(255,255,255,0.40)' }}
                        >
                          {item.version}
                        </span>
                      )}
                    </div>
                    <p
                      className="font-semibold text-[14px] leading-snug"
                      style={{ color: 'rgba(255,255,255,0.90)' }}
                    >
                      {item.title}
                    </p>
                    <p
                      className="text-[11px] mt-1"
                      style={{ color: 'rgba(255,255,255,0.40)' }}
                    >
                      {new Date(item.date).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  {/* Expand Icon */}
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0 flex items-center justify-center"
                    style={{ color: config.color, marginTop: 4 }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </motion.div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && item.description && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div
                        className="mt-3 pt-3 text-[13px] leading-relaxed"
                        style={{
                          borderTop: `1px solid ${config.border}`,
                          color: 'rgba(255,255,255,0.70)',
                        }}
                      >
                        {item.description}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 pt-6 text-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>
            定期的にアップデート情報をチェックしてください
          </p>
        </motion.div>
      </div>
    </div>
  );
}
