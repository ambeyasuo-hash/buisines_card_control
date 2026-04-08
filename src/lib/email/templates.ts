// (c) 2026 ambe / Business_Card_Folder
// Template-based email generation — zero external API calls.
// All text composition runs locally; no data leaves the browser.

function formatDate(isoDate?: string): string {
  if (!isoDate) return "先日";
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return "先日";
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return "先日";
  }
}

function buildSignature(
  displayName?: string,
  organization?: string,
  footer?: string
): string {
  const parts: string[] = [];
  if (displayName || organization) {
    parts.push("--");
    if (displayName) parts.push(displayName);
    if (organization) parts.push(organization);
  }
  if (footer) parts.push(footer);
  return parts.join("\n");
}

// ─── Thank-you email ────────────────────────────────────────────────────────

export async function generateThankYouEmailDraft(input: {
  toName: string;
  toCompany?: string;
  notes?: string;
  exchangedAt?: string;
  locationName?: string;
  userDisplayName?: string;
  userOrganization?: string;
  emailTone?: string;
  categoryFooter?: string;
}): Promise<{ subject: string; body: string }> {
  const dateStr = formatDate(input.exchangedAt);
  const location = input.locationName ? `${input.locationName}にて` : "";
  const companyStr = input.toCompany ? `${input.toCompany}の` : "";
  const noteSection = input.notes
    ? `\nまた、${input.notes}の件についても改めてご連絡できればと思います。\n`
    : "";

  const subject = `${input.toName}様 ${dateStr}はありがとうございました`;
  const sig = buildSignature(
    input.userDisplayName,
    input.userOrganization,
    input.categoryFooter
  );

  const body = [
    `${input.toName}様`,
    "",
    `${dateStr}${location}は、お名刺を頂戴し誠にありがとうございました。`,
    `${companyStr}${input.toName}様とお話しできましたこと、大変光栄に存じます。`,
    noteSection,
    "またの機会がございましたら、ぜひお声がけください。",
    "どうぞよろしくお願いいたします。",
    "",
    sig,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return { subject, body };
}

// ─── Follow-up email ────────────────────────────────────────────────────────

export async function generateFollowUpEmail(input: {
  userDisplayName?: string;
  userOrganization?: string;
  toName: string;
  toCompany?: string;
  toDepartment?: string;
  toTitle?: string;
  exchangedAt?: string;
  locationName?: string;
  notes?: string;
  emailTone?: string;
  categoryFooter?: string;
}): Promise<{ subject: string; body: string }> {
  const dateStr = formatDate(input.exchangedAt);
  const location = input.locationName ? `${input.locationName}にて` : "";
  const titleStr = [input.toDepartment, input.toTitle].filter(Boolean).join(" ");
  const greeting = titleStr
    ? `${input.toCompany ?? ""} ${titleStr} ${input.toName}様`
    : `${input.toName}様`;
  const noteSection = input.notes
    ? `\nご相談いただいておりました「${input.notes}」の件でございますが、\n改めてご説明の機会をいただけますでしょうか。\n`
    : "\n今後ともお力添えいただけますと幸いです。\n";

  const subject = `${input.toName}様 先日はありがとうございました`;
  const sig = buildSignature(
    input.userDisplayName,
    input.userOrganization,
    input.categoryFooter
  );

  const selfIntro = [input.userOrganization, input.userDisplayName]
    .filter(Boolean)
    .join(" の ");
  const intro = selfIntro
    ? `${dateStr}${location}、お名刺を交換させていただいた${selfIntro}と申します。`
    : `${dateStr}${location}、先日お名刺を交換させていただいた者です。`;

  const body = [
    greeting,
    "",
    intro,
    "先日はお忙しいところお時間をいただき、誠にありがとうございました。",
    noteSection,
    "ご都合のよい日程をご教示いただけますと幸いです。",
    "どうぞよろしくお願いいたします。",
    "",
    sig,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return { subject, body };
}
