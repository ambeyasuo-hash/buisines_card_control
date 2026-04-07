// (c) 2026 ambe / Business_Card_Folder

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">免責事項 / About</h1>

      <section className="rounded-lg border bg-card p-4 mb-6">
        <h2 className="font-semibold mb-2">免責事項（BYOモデル）</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li>
            本アプリは BYO（Bring Your Own）方式です。Supabase / Gemini のURL・キーは利用者自身が用意し、運用・管理責任は利用者にあります。
          </li>
          <li>
            API利用に伴う課金、利用制限、障害、データ消失等について、作者は責任を負いません。
          </li>
          <li>
            入力・抽出・生成された内容の正確性は保証しません。必ず利用者が最終確認してください。
          </li>
        </ul>
      </section>

      <section className="rounded-lg border bg-card p-4 mb-6">
        <h2 className="font-semibold mb-2">AIデータ取り扱いポリシー</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          <li>
            画像は OCR 解析のために Gemini 2.5 Flash に送信します。解析後、原画像は保持せず破棄します（DB保存しません）。
          </li>
          <li>
            視認性向上のため、一覧表示用に 100px 程度の超軽量サムネイル（base64）だけを `thumbnail_base64` として保存する場合があります。
          </li>
          <li>
            送信は利用者のAPIキーで実行されます（作者側のサーバー環境変数・共有キーは使用しません）。
          </li>
          <li>
            生成AIの挙動や学習への利用可否は提供元の仕様・利用規約に依存します。利用者は各サービスの最新ポリシーを確認してください。
          </li>
        </ul>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-2">コピーライト</h2>
        <p className="text-sm text-muted-foreground">© 2026 ambe</p>
      </section>
    </div>
  );
}

