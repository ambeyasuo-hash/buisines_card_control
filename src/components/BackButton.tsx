'use client';

import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';

interface BackButtonProps {
  onClick: () => void;
  className?: string;
}

export function BackButton({ onClick, className = '' }: BackButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.08, backgroundColor: 'rgba(255,255,255,0.12)' }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={`flex items-center justify-center h-10 w-10 rounded-full cursor-pointer transition-colors ${className}`}
      style={{
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(8px)',
        color: 'rgba(255,255,255,0.70)',
      }}
      title="戻る"
    >
      <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
    </motion.button>
  );
}
