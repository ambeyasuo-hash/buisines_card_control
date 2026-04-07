import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-black/10 bg-white">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight">
          あんべの名刺代わり
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/cards" className="hover:underline">
            名刺一覧
          </Link>
          <Link href="/settings" className="hover:underline">
            設定
          </Link>
        </nav>
      </div>
    </header>
  );
}
