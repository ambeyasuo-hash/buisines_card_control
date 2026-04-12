'use client';

import { AlertCircle, X, Heart } from 'lucide-react';
import { useState } from 'react';

export function ElegantRescue() {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <div className="space-y-6">
      {/* Main Content Area */}
      <div className="space-y-4">
        <div className="ambe-card-elevated p-6 space-y-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <div className="flex justify-center">
            <AlertCircle className="ambe-icon-xl text-amber-400" />
          </div>
          <h2 className="ambe-heading-2 text-center text-white">データ復旧へのご案内</h2>
          <p className="text-sm text-slate-300 text-center leading-relaxed">
            不測の事態が発生した場合、
            <br />
            安全にデータを復旧するためのサポートを提供しています。
          </p>
        </div>

        {/* Recovery Steps */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">復旧手順</h3>

          <div className="border-l-4 border-emerald-500 pl-4 py-3 bg-emerald-50 rounded-r-lg">
            <p className="text-xs font-semibold text-slate-900">Step 1</p>
            <p className="text-xs text-slate-600 mt-1">
              お持ちの携帯電話の電話帳をご確認ください
            </p>
          </div>

          <div className="border-l-4 border-blue-500 pl-4 py-3 bg-blue-50 rounded-r-lg">
            <p className="text-xs font-semibold text-slate-900">Step 2</p>
            <p className="text-xs text-slate-600 mt-1">
              「安部の名刺代わり」が登録されているか確認
            </p>
          </div>

          <div className="border-l-4 border-amber-500 pl-4 py-3 bg-amber-50 rounded-r-lg">
            <p className="text-xs font-semibold text-slate-900">Step 3</p>
            <p className="text-xs text-slate-600 mt-1">
              登録済みの場合、そこからデータを復旧します
            </p>
          </div>
        </div>

        {/* Recovery Link */}
        <div className="ambe-card p-4 text-center">
          <button
            onClick={() => setShowDialog(true)}
            className="ambe-link text-sm"
          >
            認証に失敗しましたか？
          </button>
        </div>
      </div>

      {/* Recovery Dialog */}
      {showDialog && (
        <div className="ambe-dialog-overlay">
          <div className="ambe-dialog">
            {/* Dialog Header */}
            <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border-b border-slate-200 px-6 py-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Heart className="ambe-icon-md text-emerald-600" />
                <h3 className="font-semibold text-slate-900">やさしい復旧</h3>
              </div>
              <button
                onClick={() => setShowDialog(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close dialog"
              >
                <X className="ambe-icon-md" />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                電話帳に「<span className="font-semibold text-emerald-600">安部の名刺代わり</span>」が記録されていませんか？
              </p>

              <div className="ambe-card p-3 bg-emerald-50 border-emerald-200">
                <p className="text-xs text-slate-700 leading-relaxed">
                  通常、初回の接触時に電話帳へ登録いただくと、以降のデータ同期が自動で実行されます。登録済みの場合は、その連絡先から復旧を開始できます。
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => setShowDialog(false)}
                  className="w-full ambe-button-secondary"
                >
                  電話帳を確認する
                </button>
                <button
                  onClick={() => setShowDialog(false)}
                  className="w-full ambe-button-accent"
                >
                  サポートに連絡
                </button>
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3">
              <p className="ambe-text-muted text-center">
                ご不安な点は、いつでもお気軽にお問い合わせください。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
