import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../contexts/auth-context";
import { activeReminder, todayInBusinessZone, type ReminderPeriod } from "../utils/sales-tax-reminder";

// Red banner at the very top of the CRM that reminds Jonathan to file the month's sales tax. It opens 7 days before the
// end of the month and stays until he marks it as filed (stored in sales_tax_filing_reminders, so it is dismissed for
// everyone). Only people who can open the Admin Portal see it. If the table is missing (migration 138 not run yet) or
// the lookup fails, nothing is shown - it never blocks the app.
export function SalesTaxReminderBanner({ enabled }: { enabled: boolean }) {
  const { user } = useAuth();
  const [reminder, setReminder] = useState<ReminderPeriod | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) { setReminder(null); return; }
    const { data, error } = await supabase.from("sales_tax_filing_reminders").select("period, dismissed_at");
    if (error) { setReminder(null); return; }
    const dismissed = new Set((data ?? []).filter((r: any) => r.dismissed_at).map((r: any) => String(r.period)));
    setReminder(activeReminder(todayInBusinessZone(), dismissed));
  }, [enabled]);

  useEffect(() => {
    load();
    // the date can roll over while the CRM stays open, and another tab may have dismissed it
    const t = setInterval(load, 10 * 60 * 1000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [load]);

  if (!reminder) return null;

  const markFiled = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("sales_tax_filing_reminders")
      .upsert({ period: reminder.period, dismissed_at: new Date().toISOString(), dismissed_by: user?.id ?? null }, { onConflict: "period" });
    setSaving(false);
    if (error) { toast.error("Could not mark as filed: " + error.message); return; }
    toast.success(`${reminder.label} sales tax marked as filed`);
    load();
  };

  return (
    <div role="alert" className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-red-600 px-6 py-2.5 text-white">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold">
          Reminder: report and file {reminder.label} sales tax.
        </span>
        <Link to="/admin" className="text-xs font-medium underline underline-offset-2 hover:text-red-100">
          Open Sales Tax Tracker
        </Link>
      </div>
      <button
        type="button"
        onClick={markFiled}
        disabled={saving}
        className="rounded-md border border-white/70 bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/20 disabled:opacity-60"
      >
        {saving ? "Saving…" : "I've filed it — dismiss"}
      </button>
    </div>
  );
}
