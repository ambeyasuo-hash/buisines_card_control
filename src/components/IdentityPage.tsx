'use client';

import { Download, Shield, Sparkles } from 'lucide-react';

export function IdentityPage() {
  const handleVCardExport = () => {
    alert('✨ vCard が生成されました。(デモ)\n\nダウンロード機能は Phase 1-2 で実装予定です。');
  };

  return (
    <div className="space-y-6">
      {/* Profile Hero Card */}
      <div className="ambe-card-elevated p-6 space-y-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-lg">
            <Sparkles className="ambe-icon-xl text-white" />
          </div>
        </div>

        {/* Name & Title */}
        <div className="text-center space-y-2">
          <h2 className="ambe-heading-2 text-white">安部ヤスオ</h2>
          <p className="text-sm text-emerald-300 font-medium">Business Card Folder Architect</p>
        </div>

        {/* Trust Indicator */}
        <div className="flex justify-center items-center gap-2 text-xs text-slate-300">
          <Shield className="ambe-icon-sm text-emerald-400" />
          <span>Zero-Knowledge Architecture</span>
        </div>
      </div>

      {/* Expertise Areas */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">専門領域</h3>

        {/* Expertise Card 1 */}
        <div className="ambe-card p-4 border-emerald-200 bg-emerald-50">
          <p className="text-sm font-medium text-slate-900">飲食業 DX 実装</p>
          <p className="ambe-text-secondary mt-2">
            POS システム統合、顧客データ管理、在庫最適化ソリューション
          </p>
        </div>

        {/* Expertise Card 2 */}
        <div className="ambe-card p-4 border-blue-200 bg-blue-50">
          <p className="text-sm font-medium text-slate-900">AI 実装コンサル</p>
          <p className="ambe-text-secondary mt-2">
            ビジネスロジック設計、エンドツーエンド実装、長期運用支援
          </p>
        </div>
      </div>

      {/* Contact Info */}
      <div className="ambe-card p-4 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">連絡先</h3>
        <div className="space-y-2 text-xs text-slate-600">
          <p>📧 contact@ambe.dev</p>
          <p>📱 +81-90-xxxx-xxxx</p>
          <p>🌐 ambe.dev</p>
        </div>
      </div>

      {/* vCard Export Button */}
      <button
        onClick={handleVCardExport}
        className="w-full ambe-button-accent"
      >
        <Download className="ambe-icon-sm" />
        vCard を出力
      </button>

      {/* Philosophy */}
      <div className="border-l-4 border-emerald-500 pl-4 py-3 bg-emerald-50 rounded-r-lg">
        <p className="text-xs text-slate-700 italic leading-relaxed">
          「軍用レベルの堅牢性と、隣人に寄り添う優しさ」を体現するシステムづくりを信条としています。
        </p>
      </div>
    </div>
  );
}
