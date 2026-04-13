import type { Metadata, Viewport } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "あんべの名刺代わり",
  description: "現場での出会いを最速でお礼メールと資産に変える",
  icons: { icon: "/favicon.ico" },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "あんべの名刺代わり",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  viewportFit: "cover",
  themeColor: "#F8FAFC",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white/90" style={{ colorScheme: 'dark', backgroundColor: '#0a0f1a' }}>
        <main className="flex justify-center w-full min-h-screen px-4 py-8 md:py-12" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', backgroundColor: '#0a0f1a' }}>
          <div className="w-full max-w-[600px]">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
