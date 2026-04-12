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
      <body className="relative min-h-screen overflow-x-hidden">
        {/* Dark Gradient Background with Ambient Effects */}
        <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-[#0F1419] to-slate-950 z-0">
          {/* Ambient Orbs - Premium visual effect */}
          <div className="absolute top-20 left-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl opacity-20"></div>
          <div className="absolute bottom-40 right-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl opacity-15"></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl opacity-10 -translate-x-1/2 -translate-y-1/2"></div>

          {/* Grid Pattern Overlay (subtle) */}
          <div className="absolute inset-0 opacity-5 bg-[linear-gradient(0deg,transparent_24%,rgba(255,255,255,.1)_25%,rgba(255,255,255,.1)_26%,transparent_27%,transparent_74%,rgba(255,255,255,.1)_75%,rgba(255,255,255,.1)_76%,transparent_77%,transparent)] bg-[length:64px_64px]"></div>
        </div>

        {/* Content Container */}
        <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-6">
          <div className="w-full max-w-[600px]">
            {/* Main Glass Card */}
            <div className="ambe-glass-card-lg px-6 py-8 relative">
              {/* Main Content */}
              <div className="relative z-20">{children}</div>

              {/* Footer */}
              <div className="mt-12 pt-6 border-t border-white/10 text-center">
                <p className="text-xs text-white/50">
                  © 2026 ambe / Business_Card_Folder
                </p>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
