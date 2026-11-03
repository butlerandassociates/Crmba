// A client has one primary email (clients.email) and optionally extra ones (clients.additional_emails, a
// comma-separated string) — e.g. both spouses. Jonathan, Nov 2 2026: proposals should go to all of them.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "a@x.com, b@y.com" -> ["a@x.com", "b@y.com"]. Splits on commas / semicolons / line breaks, trims, drops blanks and duplicates. */
export function parseEmailList(raw?: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw ?? "").split(/[,;\n]+/)) {
    const email = part.trim();
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    out.push(email);
  }
  return out;
}

/** The entries of a comma-separated list that are not valid email addresses. */
export function invalidEmails(raw?: string | null): string[] {
  return parseEmailList(raw).filter((e) => !EMAIL_RE.test(e));
}

/** Primary email first, then the additional ones, without duplicates. */
export function clientRecipientEmails(client?: { email?: string | null; additional_emails?: string | null } | null): string[] {
  return parseEmailList([client?.email ?? "", client?.additional_emails ?? ""].join(","));
}
