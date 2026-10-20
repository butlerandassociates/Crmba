import { Mail, MailOpen } from "lucide-react";

export type EmailTrackingRow = {
  id: string;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
};

const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

// Indicator under an "Email sent" Activity Log entry (Jonathan, Oct 19 2026). Opens are a good indicator, not
// proof: Apple Mail / Gmail can pre-load the tracking image, and blocked images hide real opens.
export function EmailOpenBadge({ row }: { row?: EmailTrackingRow }) {
  const opened = !!row && row.open_count > 0 && !!row.first_opened_at;
  if (!opened) {
    return (
      <span className="inline-flex items-center gap-1 mt-1 text-[11px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">
        <Mail className="h-3 w-3" />Not opened yet
      </span>
    );
  }
  const title = row!.open_count > 1 && row!.last_opened_at ? `Last opened ${fmt(row!.last_opened_at)}` : undefined;
  return (
    <span title={title} className="inline-flex items-center gap-1 mt-1 text-[11px] px-1.5 py-0.5 rounded-md bg-green-100 text-green-700">
      <MailOpen className="h-3 w-3" />
      Opened {fmt(row!.first_opened_at!)}{row!.open_count > 1 ? ` · ${row!.open_count}×` : ""}
    </span>
  );
}
