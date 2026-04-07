// (c) 2026 ambe / Business_Card_Folder

import OCRCamera from "@/components/cards/OCRCamera";

export default function NewCardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">スキャン</h1>
      <OCRCamera />
    </div>
  );
}

