'use client';

import { Download, Shield, Sparkles } from 'lucide-react';

export function IdentityPage() {
  const handleVCardExport = () => {
    alert('✨ vCard が生成されました。(デモ)\n\nダウンロード機能は Phase 1-2 で実装予定です。');
  };

  return (
    <div className="space-y-6">
      {/* Profile Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg p-6 text-white space-y-4">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Name & Title */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">安部ヤスオ</h2>
          <p className="text-sm text-emerald-300 font-medium">Business Card Folder Architect</p>
        </div>

        {/* Trust Indicator */}
        <div className="flex justify-center items-center gap-2 text-xs text-slate-300">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Zero-Knowledge Architecture</span>
        </div>
      </div>

      {/* Expertise Areas */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">専門領域</h3>

        {/* Expertise Card 1 */}
        <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50">
          <p className="text-sm font-medium text-slate-800">飲食業 DX 実装</p>
          <p className="text-xs text-slate-600 mt-1">
            POS システム統合、顧客データ管理、在庫最適化ソリューション
          </p>
        </div>

        {/* Expertise Card 2 */}
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
          <p className="text-sm font-medium text-slate-800">AI 実装コンサル</p>
          <p className="text-xs text-slate-600 mt-1">
            ビジネスロジック設計、エンドツーエンド実装、長期運用支援
          </p>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-slate-50 rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">連絡先</h3>
        <div className="space-y-1 text-xs text-slate-600">
          <p>📧 contact@ambe.dev</p>
          <p>📱 +81-90-xxxx-xxxx</p>
          <p>🌐 ambe.dev</p>
        </div>
      </div>

      {/* vCard Export Button */}
      <button
        onClick={handleVCardExport}
        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
      >
        <Download className="w-4 h-4" />
        vCard を出力
      </button>

      {/* Philosophy */}
      <div className="border-l-4 border-emerald-400 pl-4 py-2">
        <p className="text-xs text-slate-600 italic">
          「軍用レベルの堅牢性と、隣人に寄り添う優しさ」を体現するシステムづくりを信条としています。
        </p>
      </div>
    </div>
  );
}
