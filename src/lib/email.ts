// (c) 2026 ambe / Business_Card_Folder
// Legacy Email Generation (Phase 2): Simple thank-you draft
// For Phase 3 zero-knowledge generation, use generateEmailTemplateAction instead

/**
 * Generate a simple thank-you email draft
 * This is a legacy implementation - for Phase 3, use generateEmailTemplateAction with masking
 *
 * @param options - Email parameters
 * @returns Simple thank-you email subject and body
 */
export function generateThankYouEmailDraft(options: {
  toName: string;
  toCompany?: string;
  notes?: string;
  exchangedAt?: string;
}): { subject: string; body: string } {
  const name = options.toName || "交換相手";
  const company = options.toCompany ? `${options.toCompany}の` : "";

  const subject = `名刺交換のお礼 - ${name}様へ`;

  const body = `${name}様

いつもお世話になっております。

先日は名刺交換の機会をいただき、ありがとうございました。
${company}ご活躍をお祈りしております。

何かお役に立てることがございましたら、
お気軽にお声がけください。

引き続き、よろしくお願いいたします。

---
本メールは名刺管理アプリケーションから自動生成されました。`;

  return { subject, body };
}

/**
 * Generate a follow-up email draft
 * Used for view/detail pages to send follow-up communications
 *
 * @param options - Email parameters
 * @returns Follow-up email subject and body
 */
export function generateFollowUpEmail(options: {
  toName: string;
  toCompany?: string;
  toDepartment?: string;
  toTitle?: string;
  notes?: string;
  exchangedAt?: string;
  locationName?: string;
  userDisplayName?: string;
  userOrganization?: string;
  emailTone?: string;
  categoryFooter?: string;
}): { subject: string; body: string } {
  const name = options.toName || "交換相手";
  const company = options.toCompany ? `${options.toCompany}の` : "";
  const department = options.toDepartment ? `${options.toDepartment}` : "";
  const title = options.toTitle ? `${options.toTitle}` : "";

  const subject = `${name}${title ? ` (${title})` : ""}様へのご連絡`;

  const body = `${name}${title ? `（${title}）` : ""}様

いつもお世話になっております。

先日は名刺交換の機会をいただきありがとうございました。
${company}${department}のご活躍をお祈りしております。

何かお力になれることがあれば、
お気軽にお知らせください。

引き続き、よろしくお願いいたします。

${options.userDisplayName ? `---\n${options.userDisplayName}` : ""}
${options.userOrganization ? `${options.userOrganization}\n` : ""}
本メールは名刺管理アプリケーションから自動生成されました。`;

  return { subject, body };
}
