import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "あんべの名刺代わり v5.0.5 | Phoenix Edition",
  description:
    "Zero-Knowledge + Searchable Encryption + Elegant Resilience Business Card Platform",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-slate-100 min-h-screen">
        {/* Ambe Design System: Mobile-Centric 600px Container with Device-like Appearance */}
        <div className="flex items-center justify-center min-h-screen px-4 py-8">
          <div className="w-full max-w-[600px] bg-white rounded-xl shadow-2xl overflow-hidden">
            {/* Header Bar */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4">
              <h1 className="text-lg font-bold tracking-tight">
                あんべの名刺代わり
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                v5.0.5 Phoenix Edition
              </p>
            </div>

            {/* Main Content */}
            <div className="px-6 py-8">{children}</div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 text-center">
              <p className="text-xs text-slate-500">
                © 2026 ambe / Business_Card_Folder
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
