'use client';

import { AlertCircle, X, Heart } from 'lucide-react';
import { useState } from 'react';

export function ElegantRescue() {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <div className="space-y-6">
      {/* Main Content Area */}
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-6 text-white space-y-4">
          <div className="flex justify-center">
            <AlertCircle className="w-12 h-12 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-center">データ復旧へのご案内</h2>
          <p className="text-sm text-slate-300 text-center leading-relaxed">
            不測の事態が発生した場合、
            <br />
            安全にデータを復旧するためのサポートを提供しています。
          </p>
        </div>

        {/* Recovery Steps */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">復旧手順</h3>

          <div className="border-l-4 border-emerald-500 pl-4 py-2 bg-emerald-50 rounded-r-lg">
            <p className="text-xs font-medium text-slate-800">Step 1</p>
            <p className="text-xs text-slate-600 mt-1">
              お持ちの携帯電話の電話帳をご確認ください
            </p>
          </div>

          <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r-lg">
            <p className="text-xs font-medium text-slate-800">Step 2</p>
            <p className="text-xs text-slate-600 mt-1">
              「安部の名刺代わり」が登録されているか確認
            </p>
          </div>

          <div className="border-l-4 border-amber-500 pl-4 py-2 bg-amber-50 rounded-r-lg">
            <p className="text-xs font-medium text-slate-800">Step 3</p>
            <p className="text-xs text-slate-600 mt-1">
              登録済みの場合、そこからデータを復旧します
            </p>
          </div>
        </div>

        {/* Recovery Link */}
        <div className="border border-slate-200 rounded-lg p-4 text-center">
          <button
            onClick={() => setShowDialog(true)}
            className="text-emerald-600 hover:text-emerald-700 font-medium text-sm underline transition-colors"
          >
            認証に失敗しましたか？
          </button>
        </div>
      </div>

      {/* Recovery Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full overflow-hidden animate-in">
            {/* Dialog Header */}
            <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border-b border-slate-200 px-6 py-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-slate-900">やさしい復旧</h3>
              </div>
              <button
                onClick={() => setShowDialog(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                電話帳に「<span className="font-medium text-emerald-600">安部の名刺代わり</span>」が記録されていませんか？
              </p>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  通常、初回の接触時に電話帳へ登録いただくと、以降のデータ同期が自動で実行されます。登録済みの場合は、その連絡先から復旧を開始できます。
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => setShowDialog(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium py-2 rounded-lg transition-colors"
                >
                  電話帳を確認する
                </button>
                <button
                  onClick={() => setShowDialog(false)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg transition-colors"
                >
                  サポートに連絡
                </button>
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3">
              <p className="text-xs text-slate-500 text-center">
                ご不安な点は、いつでもお気軽にお問い合わせください。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
