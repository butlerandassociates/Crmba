import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Calendar } from "./ui/calendar";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Clock, Loader2, Link as LinkIcon, Video, Mail } from "lucide-react";
import { format } from "date-fns";
import { clientsAPI, appointmentsAPI, usersAPI, activityLogAPI } from "../utils/api";
import { supabase } from "@/lib/supabase";

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  onAppointmentScheduled?: () => void;
}


export function AppointmentDialog({
  open,
  onOpenChange,
  client,
  onAppointmentScheduled,
}: AppointmentDialogProps) {

  const [appointmentType, setAppointmentType] = useState("");
  const [selectedDate, setSelectedDate]       = useState<Date | undefined>();
  const [startTime, setStartTime]             = useState("");
  const [endTime, setEndTime]                 = useState("");
  const [notes, setNotes]                     = useState("");
  const [ccEmails, setCcEmails]               = useState("");
  const [ccEmailsError, setCcEmailsError]     = useState("");
  const [scheduling, setScheduling]           = useState(false);
  const [touched, setTouched]                 = useState(false);
  const [teamMembers, setTeamMembers]           = useState<any[]>([]);
  const [salesRepIds, setSalesRepIds]           = useState<Set<string>>(new Set());
  const [assignedUserId, setAssignedUserId]     = useState("");
  const [appointmentTypes, setAppointmentTypes] = useState<any[]>([]);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showRepPreview, setShowRepPreview] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [scopeMap, setScopeMap] = useState<Record<string, string>>({});
  const [repEmailTemplate, setRepEmailTemplate] = useState<{ subject: string | null; body: string | null }>({ subject: null, body: null });

  useEffect(() => {
    Promise.all([
      usersAPI.getByRole("sales_rep"),
      usersAPI.getByRole("admin"),
    ]).then(([reps, admins]) => {
      setTeamMembers([...reps, ...admins]);
      setSalesRepIds(new Set(reps.map((r: any) => r.id)));
    }).catch(console.error);
    supabase.from("appointment_types").select("*").eq("is_active", true).order("sort_order")
      .then(({ data }) => setAppointmentTypes(data ?? []));
    // Scope-of-work id → name map, used to list the client's selected scopes in the rep email
    supabase.from("scope_of_work").select("id, name")
      .then(({ data }) => setScopeMap(Object.fromEntries((data ?? []).map((s: any) => [s.id, s.name]))));
    supabase.from("company_settings")
      .select("google_calendar_refresh_token, rep_email_subject, rep_email_body")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setCalendarConnected(!!data?.google_calendar_refresh_token);
        setRepEmailTemplate({ subject: data?.rep_email_subject ?? null, body: data?.rep_email_body ?? null });
      });
  }, []);

  useRealtimeRefetch(() => {
    Promise.all([usersAPI.getByRole("sales_rep"), usersAPI.getByRole("admin")])
      .then(([reps, admins]) => { setTeamMembers([...reps, ...admins]); setSalesRepIds(new Set(reps.map((r: any) => r.id))); })
      .catch(console.error);
    supabase.from("appointment_types").select("*").eq("is_active", true).order("sort_order")
      .then(({ data }) => setAppointmentTypes(data ?? []));
  }, ["profiles", "appointment_types"], "appt-dialog");

  const INTAKE_FORM_URL = `https://docs.google.com/forms/d/e/1FAIpQLSed6YY4dNn7yn_U7IakCfyTdQpNowwi48e1p3S9vgU7iKR7Rg/viewform?entry.1284149011=${encodeURIComponent(client?.id ?? "")}`;

  const buildPreviewHtml = () => {
    const apptType = appointmentTypes.find((t) => t.id === appointmentType);
    const typeName = apptType?.name ?? "Appointment";
    const dateLabel = selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "—";
    const fmt12 = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12  = h % 12 || 12;
      return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
    };
    const timeLabel = startTime && endTime ? `${fmt12(startTime)} – ${fmt12(endTime)}` : "—";
    const vars: Record<string, string> = {
      client_name: clientName,
      date: dateLabel,
      time: timeLabel,
      type: typeName,
      address: clientAddress || "",
      intake_form_url: INTAKE_FORM_URL,
      meet_link: "",
    };
    const rawBody = apptType?.email_body?.trim() ||
      `Your {type} has been confirmed.\n\nDate: {date}\nTime: {time}\nLocation: {address}\n\nWe look forward to meeting with you!`;
    const body = Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), rawBody);
    const isInitialAppointment = typeName.toLowerCase().includes("initial") && !client?.intake_form_completed;
    const intakeFormBlock = isInitialAppointment ? `
    <div style="border:1px solid #E8E4DC;border-radius:6px;padding:20px 24px;margin:0 0 28px 0;background:#FAFAF8;">
      <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 8px 0;">Before Your Appointment</p>
      <p style="font-family:Inter,sans-serif;font-size:13px;color:#3A3A38;line-height:1.6;margin:0 0 16px 0;">Please take a moment to complete our intake form — it helps us prepare and make the most of your time with us.</p>
      <div style="text-align:center;"><a href="${INTAKE_FORM_URL}" target="_blank" style="display:inline-block;background:#0A0A0A;color:#BB984D;font-family:Inter,sans-serif;font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:12px 24px;border-radius:4px;">Complete Intake Form →</a></div>
    </div>` : "";
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Lato:wght@400;700&family=Inter:wght@400;500&display=swap" rel="stylesheet"/><style>::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,.18);border-radius:4px}::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.32)}*{scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.18) transparent}</style></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Inter,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px 6px 0 0;overflow:hidden;"><tr>
    <td bgcolor="#0A0A0A" style="background:#0A0A0A;border-radius:6px 6px 0 0;padding:28px 32px;text-align:center;">
      <img src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png" alt="Butler &amp; Associates" height="56" style="height:56px;width:auto;display:block;margin:0 auto 12px auto;border:0;outline:none;"/>
      <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
    </td>
  </tr></table>
  <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);"></div>
  <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 6px 6px;padding:32px;">
    <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 10px 0;">Message from Butler &amp; Associates</p>
    <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 28px 0;">${body.replace(/\n/g, '<br>')}</p>
    ${intakeFormBlock}
    <p style="font-family:Inter,sans-serif;font-size:12px;color:#3A3A38;opacity:0.65;margin:0;line-height:1.6;">Questions? Reply to this email or reach us at <a href="tel:2566174691" style="color:#BB984D;text-decoration:none;">(256) 617-4691</a>.</p>
  </div>
  <div style="text-align:center;padding:20px 0 0 0;">
    <p style="font-family:Inter,sans-serif;font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
    <p style="font-family:Inter,sans-serif;font-size:11px;color:#3A3A38;opacity:0.55;margin:4px 0 0 0;">6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806</p>
  </div>
</div></body></html>`;
  };

  const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim() || client?.company || "Client";
  const clientAddress = [client?.address, client?.city, client?.state, client?.zip].filter(Boolean).join(", ");

  // The rep "field info" email only applies to Initial Appointments
  const selectedTypeName = appointmentTypes.find((t) => t.id === appointmentType)?.name ?? "";
  const isInitialAppointment = selectedTypeName.toLowerCase().includes("initial");

  // Resolve the client's selected scope-of-work IDs into readable names
  const scopeNames = (Array.isArray(client?.scope_of_work) ? client.scope_of_work : [])
    .map((id: string) => scopeMap[id] ?? id)
    .filter(Boolean);

  // Replace {placeholder} tokens in admin-editable templates
  const fillVars = (tpl: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), tpl);

  /**
   * Branded "field info" email sent to the assigned sales rep (or whoever the
   * appointment is assigned to). Same B&A branding as the client email, but the
   * body lists the full client contact info + scope so the rep has everything
   * on hand when they're out in the field without CRM access.
   */
  const buildRepEmailHtml = (repFirstName: string, dateLabel: string, timeLabel: string, typeName: string) => {
    // Admin-editable message (List Management → Appointment Types → Rep Email Body),
    // falls back to a sensible default. Branded layout + details table stay fixed.
    const apptType = appointmentTypes.find((t) => t.id === appointmentType);
    const vars: Record<string, string> = {
      rep_name:    repFirstName || "there",
      client_name: clientName,
      date:        dateLabel,
      time:        timeLabel,
      type:        typeName,
      address:     clientAddress || "Not provided",
      phone:       client?.phone || "Not provided",
      email:       client?.email || "Not provided",
      scope:       scopeNames.length ? scopeNames.join(", ") : "Not specified yet",
    };
    const defaultBody =
      "Hi {rep_name},\nYou've been assigned a {type}. Here are the client details for your records — keep this handy in case you're in the field without CRM access.";
    const messageHtml = fillVars((repEmailTemplate.body?.trim() || defaultBody), vars).replace(/\n/g, "<br>");

    const row = (label: string, value: string) =>
      `<tr><td style="padding:11px 16px;font-family:Inter,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#1A1A1A;border-bottom:1px solid #F5F3EF;white-space:nowrap;vertical-align:top;width:130px;">${label}</td><td style="padding:11px 16px;font-family:Inter,sans-serif;font-size:14px;color:#1A1A1A;border-bottom:1px solid #F5F3EF;">${value}</td></tr>`;
    const placeholder = (text: string) => `<span style="color:#1A1A1A;">${text}</span>`;
    const phoneCell = client?.phone
      ? `<a href="tel:${String(client.phone).replace(/[^0-9+]/g, "")}" style="color:#1A1A1A;text-decoration:none;">${client.phone}</a>` : placeholder("Not provided");
    const emailCell = client?.email
      ? `<a href="mailto:${client.email}" style="color:#1A1A1A;text-decoration:none;">${client.email}</a>` : placeholder("Not provided");
    const addressCell = clientAddress
      ? `<a href="https://maps.google.com/?q=${encodeURIComponent(clientAddress)}" target="_blank" style="color:#1A1A1A;text-decoration:none;">${clientAddress}</a>` : placeholder("Not provided");
    const scopeCell = scopeNames.length > 0
      ? scopeNames.map((s: string) => `<span style="display:inline-block;background:#F5F3EF;border:1px solid #E8E4DC;border-radius:4px;padding:3px 9px;margin:0 4px 4px 0;font-size:12px;color:#1A1A1A;">${s}</span>`).join("")
      : "<span style=\"color:#1A1A1A;\">Not specified yet</span>";
    const notesBlock = notes?.trim()
      ? `<div style="margin:0 0 28px 0;"><p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 8px 0;">Notes</p><p style="font-family:Inter,sans-serif;font-size:13px;color:#1A1A1A;line-height:1.6;margin:0;">${notes.replace(/\n/g, "<br>")}</p></div>` : "";

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Inter,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px 6px 0 0;overflow:hidden;"><tr>
    <td bgcolor="#0A0A0A" style="background:#0A0A0A;border-radius:6px 6px 0 0;padding:28px 32px;text-align:center;">
      <img src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png" alt="Butler &amp; Associates" height="56" style="height:56px;width:auto;display:block;margin:0 auto 12px auto;border:0;outline:none;"/>
      <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
    </td>
  </tr></table>
  <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);"></div>
  <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 6px 6px;padding:32px;">
    <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 10px 0;">New Appointment Assigned</p>
    <p style="font-family:Inter,sans-serif;font-size:14px;color:#1A1A1A;line-height:1.7;margin:0 0 24px 0;">${messageHtml}</p>

    <!-- When -->
    <div style="background:#0A0A0A;border-radius:6px;padding:18px 20px;margin:0 0 20px 0;text-align:center;">
      <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 6px 0;">${typeName}</p>
      <p style="font-family:Inter,sans-serif;font-size:18px;font-weight:700;color:#fff;margin:0 0 2px 0;">${dateLabel}</p>
      <p style="font-family:Inter,sans-serif;font-size:14px;color:#BB984D;margin:0;">${timeLabel}</p>
    </div>

    <!-- Client details -->
    <div style="margin:0 0 28px 0;">
      <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 10px 0;">Client Information</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid #E8E4DC;">
        ${row("Name", clientName)}
        ${row("Phone", phoneCell)}
        ${row("Email", emailCell)}
        ${row("Address", addressCell)}
        <tr><td style="padding:11px 16px;font-family:Inter,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#1A1A1A;vertical-align:top;width:130px;">Scope of Work</td><td style="padding:11px 16px;">${scopeCell}</td></tr>
      </table>
    </div>

    ${notesBlock}

    <p style="font-family:Inter,sans-serif;font-size:12px;color:#3A3A38;opacity:0.65;margin:0;line-height:1.6;">Questions? Reply to this email or reach the office at <a href="tel:2566174691" style="color:#BB984D;text-decoration:none;">(256) 617-4691</a>.</p>
  </div>
  <div style="text-align:center;padding:20px 0 0 0;">
    <p style="font-family:Inter,sans-serif;font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
    <p style="font-family:Inter,sans-serif;font-size:11px;color:#3A3A38;opacity:0.55;margin:4px 0 0 0;">6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806</p>
  </div>
</div></body></html>`;
  };

  // Wrapper that derives date/time/rep labels from the current form state for the preview
  const buildRepPreviewHtml = () => {
    const apptType = appointmentTypes.find((t) => t.id === appointmentType);
    const typeName = apptType?.name ?? "Appointment";
    const dateLabel = selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "—";
    const fmt12 = (t: string) => {
      if (!t) return "";
      const [h, m] = t.split(":").map(Number);
      return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    };
    const timeLabel = startTime && endTime ? `${fmt12(startTime)} – ${fmt12(endTime)}` : "—";
    const rep = teamMembers.find((m) => m.id === assignedUserId);
    return buildRepEmailHtml(rep?.first_name ?? "", dateLabel, timeLabel, typeName);
  };

  const handleSchedule = async () => {
    setTouched(true);
    if (!appointmentType || !selectedDate || !startTime) return;
    try {
      setScheduling(true);

      const typeLabel = appointmentTypes.find((t) => t.id === appointmentType)?.name ?? "Appointment";

      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);

      const startDT = new Date(selectedDate);
      startDT.setHours(sh, sm, 0, 0);
      const endDT = new Date(selectedDate);
      endDT.setHours(eh, em, 0, 0);

      if (endDT <= startDT) {
        toast.error("End time must be after start time");
        return;
      }

      const assignedUser = teamMembers.find((u) => u.id === assignedUserId);
      const assignedEmail = assignedUser?.email ?? null;
      const ccList = [
        ...(assignedEmail ? [assignedEmail] : []),
        ...ccEmails.split(",").map((e) => e.trim()).filter(Boolean),
      ];
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Save to appointments table first (calendar/meet link filled in after email send)
      await appointmentsAPI.create({
        client_id:                client.id,
        title:                    `${typeLabel} – ${clientName}`,
        appointment_type:         appointmentType,
        appointment_date:         startDT.toISOString().split("T")[0],
        appointment_time:         startTime,
        end_time:                 endTime,
        notes:                    notes || null,
        assigned_to:              assignedUserId || null,
        google_calendar_event_id: null,
        google_meet_link:         null,
        google_event_html_link:   null,
        email_notification_sent:  false,
      });

      // Save as official sales rep if assigned user is a sales rep
      if (assignedUserId && salesRepIds.has(assignedUserId) && !client.sales_rep_id) {
        clientsAPI.assignSalesRep(client.id, assignedUserId).catch(() => {});
      }

      // Log appointment scheduled — awaited so it's written before the heavy
      // email/SMS calls and the dialog closing (a fire-and-forget insert here was
      // getting dropped before it completed). .catch keeps it non-blocking.
      await activityLogAPI.create({
        client_id: client.id,
        action_type: "appointment_scheduled",
        description: `${typeLabel} scheduled for ${format(startDT, "MMM d, yyyy")} at ${format(startDT, "h:mm a")} – ${format(endDT, "h:mm a")}${assignedUser ? ` — assigned to ${assignedUser.first_name} ${assignedUser.last_name}` : ""}`,
      }).catch(() => {});

      // Update client record — advance Prospect → Scheduled automatically
      const clientUpdate: Record<string, any> = {
        appointment_scheduled: true,
        appointment_date:      startDT.toISOString(),
        appointment_end_date:  endDT.toISOString(),
      };
      if (client.status === "prospect") {
        const { data: scheduledStage } = await supabase
          .from("pipeline_stages").select("id").ilike("name", "scheduled").limit(1).maybeSingle();
        clientUpdate.status = "scheduled";
        if (scheduledStage?.id) clientUpdate.pipeline_stage_id = scheduledStage.id;
        activityLogAPI.create({
          client_id:   client.id,
          action_type: "status_changed",
          description: `Pipeline stage advanced: Prospect → Scheduled (appointment booked)`,
        }).catch(() => {});
      }
      await clientsAPI.update(client.id, clientUpdate);

      // Send branded confirmation email via SendGrid
      const timeLabel = `${format(startDT, "h:mm a")} – ${format(endDT, "h:mm a")}`;
      const dateLabel = format(startDT, "EEEE, MMMM d, yyyy");
      let emailSent        = false;
      let smsSent          = false;
      let calendarEventId: string | null = null;
      let googleMeetLink:  string | null = null;
      let calendarHtmlLink: string | null = null;

      const { data: emailData, error: emailErr } = await supabase.functions.invoke(
        "send-appointment-email",
        {
          body: {
            appointment_type_id: appointmentType,
            client_id:      client.id,
            client_name:    clientName,
            client_email:   client.email,
            client_address: clientAddress || null,
            date:           dateLabel,
            time:           timeLabel,
            title:          `${typeLabel} – ${clientName}`,
            start_datetime: startDT.toISOString(),
            end_datetime:   endDT.toISOString(),
            time_zone:      timeZone,
            cc_emails:      ccList,
          },
        }
      );
      if (emailErr || emailData?.error) {
        const reason = emailErr?.message ?? emailData?.error ?? "Unknown error";
        activityLogAPI.create({
          client_id:    client.id,
          action_type:  "email_failed",
          description:  `Appointment confirmation email failed to deliver to ${client.email}: ${reason}`,
        }).catch(() => {});
      } else {
        emailSent = true;
        calendarEventId  = emailData?.calendar_event_id ?? null;
        googleMeetLink   = emailData?.google_meet_link ?? null;
        calendarHtmlLink = emailData?.calendar_html_link ?? null;
        void supabase.from("appointments")
          .update({
            email_notification_sent:  true,
            google_calendar_event_id: calendarEventId,
            google_meet_link:         googleMeetLink,
            google_event_html_link:   calendarHtmlLink,
          })
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(1);
      }

      // Send branded "field info" email to the assigned rep — ONLY for Initial Appointments
      // (per Jonathan's request: reps get the client info sheet when an Initial Appointment is booked)
      if (assignedEmail && typeLabel.toLowerCase().includes("initial")) {
        const repFirstName = assignedUser?.first_name ?? "";
        const repHtml = buildRepEmailHtml(repFirstName, dateLabel, timeLabel, typeLabel);
        // Editable subject (List Management → Sales Rep Email Template), with fallback
        const subjVars = { rep_name: repFirstName || "there", client_name: clientName, date: dateLabel, time: timeLabel, type: typeLabel };
        const repSubject = repEmailTemplate.subject?.trim()
          ? fillVars(repEmailTemplate.subject.trim(), subjVars)
          : `New ${typeLabel}: ${clientName} — ${dateLabel}`;
        supabase.functions.invoke("send-email", {
          body: {
            to:        assignedEmail,
            subject:   repSubject,
            html:      repHtml,
            from_name: "Butler & Associates Construction",
          },
        }).then(({ error: repErr }) => {
          if (repErr) {
            activityLogAPI.create({
              client_id:   client.id,
              action_type: "email_failed",
              description: `Rep appointment-details email failed to deliver to ${assignedEmail}: ${repErr.message}`,
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      // Send SMS confirmation via Twilio
      if (client?.phone) {
        const INTAKE_FORM_BASE = "https://docs.google.com/forms/d/e/1FAIpQLSed6YY4dNn7yn_U7IakCfyTdQpNowwi48e1p3S9vgU7iKR7Rg/viewform";
        const isInitialAppt = typeLabel.toLowerCase().includes("initial");
        const smsIntakeUrl = (isInitialAppt && !client.intake_form_completed)
          ? `${INTAKE_FORM_BASE}?entry.1284149011=${encodeURIComponent(client.id)}`
          : null;
        const { data: smsData, error: smsErr } = await supabase.functions.invoke(
          "send-appointment-sms",
          {
            body: {
              client_phone:      client.phone,
              client_first_name: client.first_name ?? "",
              date:              dateLabel,
              time:              timeLabel,
              intake_form_url:   smsIntakeUrl,
            },
          }
        );
        if (smsErr || smsData?.error) {
          const reason = smsErr?.message ?? smsData?.error ?? "Unknown error";
          activityLogAPI.create({
            client_id:    client.id,
            action_type:  "sms_failed",
            description:  `Appointment SMS failed to deliver to ${client.phone}: ${reason}`,
          }).catch(() => {});
        } else {
          smsSent = true;
        }
      }

      // const meetLink = googleMeetLink; // hidden: in-person appointments only

      // Primary success toast
      toast.success(
        `Appointment scheduled!${emailSent ? ` Invite sent to ${client.email}.` : ""}`,
        { duration: 6000 }
      );

      // Failure toasts (shown after success so they appear on top)
      if (!emailSent) {
        toast.error(
          `Confirmation email could not be sent to ${client.email}. Check the address is correct.`,
          { duration: 8000 }
        );
      }
      if (client?.phone && !smsSent) {
        toast.error(
          `SMS could not be sent to ${client.phone}. Check the phone number is correct.`,
          { duration: 8000 }
        );
      }

      // if (meetLink) {
      //   toast.info(
      //     <span>Meet link: <a href={meetLink} target="_blank" rel="noopener noreferrer" className="underline font-medium">{meetLink}</a></span>,
      //     { duration: 10000 }
      //   );
      // }

      onOpenChange(false);
      onAppointmentScheduled?.();
    } catch (error: any) {
      console.error("Failed to schedule appointment:", error);
      toast.error(error.message || "Failed to schedule appointment");
    } finally {
      setScheduling(false);
    }
  };

  const resetForm = () => {
    setAppointmentType("");
    setSelectedDate(undefined);
    setStartTime("");
    setEndTime("");
    setNotes("");
    setCcEmails("");
    setCcEmailsError("");
    setAssignedUserId("");
    setTouched(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Schedule Appointment</DialogTitle>
          <DialogDescription>
            Schedule an in-person appointment with {clientName} — creates a Google Calendar event, sends confirmation email and SMS automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Sticky banners — outside DialogBody so they don't scroll away */}
        {calendarConnected === false && (
          <div className="pb-2">
            <div className="px-6 py-3 bg-yellow-50 border border-yellow-300 text-xs text-yellow-800">
              <span className="font-semibold">Google Calendar is not connected.</span> Go to <a href="/integrations" className="underline font-medium">Integrations</a> and complete the one-time setup before scheduling appointments.
            </div>
          </div>
        )}
        {!client?.email && (
          <div className="pb-2">
            <div className="px-6 py-3 bg-red-50 border border-red-300 text-xs text-red-800">
              <span className="font-semibold">No email on file.</span> Go to <a href={`/clients/${client?.id}`} className="underline font-medium">Edit Client</a> and add an email address before scheduling.
            </div>
          </div>
        )}
        {!client?.phone && (
          <div className="pb-2">
            <div className="px-6 py-3 bg-yellow-50 border border-yellow-300 text-xs text-yellow-800">
              No phone number on this client — SMS confirmation will not be sent.
            </div>
          </div>
        )}

        <DialogBody className="space-y-5">
          {/* Assigned To */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Assigned To *</Label>
              {assignedUserId && appointmentType && selectedDate && startTime && endTime && isInitialAppointment && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setShowRepPreview(true)}
                >
                  <Mail className="h-3 w-3" />
                  Preview Rep Email
                </Button>
              )}
            </div>
            <Select value={assignedUserId} onValueChange={setAssignedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                    {u.email && <span className="text-muted-foreground ml-1 text-xs">({u.email})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">They will receive the calendar invite alongside the client.</p>
            {(() => {
              if (!assignedUserId || !salesRepIds.has(assignedUserId)) return null;
              const rep = teamMembers.find((m) => m.id === assignedUserId);
              if (!rep || rep.commission_rate !== 0) return null;
              return (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <span className="mt-0.5">⚠️</span>
                  <span><strong>{rep.first_name} {rep.last_name}</strong> has no commission rate set — their commission won&apos;t be tracked on any deal until you add a rate in <a href="/team" target="_blank" rel="noopener noreferrer" className="underline font-medium">Team settings</a>.</span>
                </div>
              );
            })()}
          </div>

          {/* Client Email — read only, sourced from client record */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Client Email</Label>
              {appointmentType && client?.email && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setShowEmailPreview(true)}
                >
                  <Mail className="h-3 w-3" />
                  Preview Email
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {client?.email ?? <span className="italic">No email on file</span>}
            </div>
            <p className="text-xs text-muted-foreground">Pulled from client record — update it there to change.</p>
          </div>

          {/* Appointment Type */}
          <div className="space-y-2">
            <Label>Appointment Type <span className="text-destructive">*</span></Label>
            <Select value={appointmentType} onValueChange={setAppointmentType}>
              <SelectTrigger className={touched && !appointmentType ? "border-red-500" : ""}>
                <SelectValue placeholder="Select appointment type" />
              </SelectTrigger>
              <SelectContent>
                {appointmentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {touched && !appointmentType && <p className="text-xs text-red-500">Appointment type is required.</p>}
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Select Date <span className="text-destructive">*</span></Label>
            <div className={`border rounded-lg overflow-hidden flex justify-center ${touched && !selectedDate ? "border-red-500" : ""}`}>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="w-[340px] p-4"
                classNames={{
                  months: "w-full",
                  month: "w-full flex flex-col gap-4",
                  caption: "flex justify-center pt-1 relative items-center w-full",
                  caption_label: "text-sm font-medium",
                  table: "w-full border-collapse",
                  head_row: "flex w-full",
                  head_cell: "text-muted-foreground font-normal text-[0.8rem] flex-1 text-center",
                  row: "flex w-full mt-2",
                  cell: "flex-1 relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected])]:rounded-md",
                  day: "w-full h-9 p-0 font-normal rounded-md hover:bg-accent hover:text-accent-foreground aria-selected:opacity-100 flex items-center justify-center text-sm",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_today: "bg-accent text-accent-foreground font-semibold",
                  day_outside: "text-muted-foreground opacity-40",
                  day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed",
                  day_hidden: "invisible",
                  nav: "flex items-center gap-1",
                  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border rounded-md flex items-center justify-center",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                }}
              />
            </div>
            {touched && !selectedDate && <p className="text-xs text-red-500">Date is required.</p>}
            {selectedDate && (
              <p className="text-sm text-muted-foreground">
                <CalendarIcon className="h-3 w-3 inline mr-1" />
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </p>
            )}
          </div>

          {/* Time */}
          {(() => {
            const timeSlots = Array.from({ length: 48 }, (_, i) => {
              const h = Math.floor(i / 2);
              const m = i % 2 === 0 ? "00" : "30";
              const ampm = h >= 12 ? "PM" : "AM";
              const h12 = h % 12 || 12;
              return { value: `${String(h).padStart(2, "0")}:${m}`, label: `${h12}:${m} ${ampm}` };
            });
            return (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    <Clock className="h-3 w-3 inline mr-1" />
                    Start Time <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={startTime}
                    onValueChange={(val) => {
                      setStartTime(val);
                      // Auto-fill end time to 1 hour after start (user can override below)
                      const [h, m] = val.split(":").map(Number);
                      const total = h * 60 + m + 60;
                      const eh = Math.floor(total / 60) % 24;
                      const em = total % 60;
                      setEndTime(`${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`);
                    }}
                  >
                    <SelectTrigger className={touched && !startTime ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {timeSlots.map((slot) => (
                        <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {touched && !startTime && <p className="text-xs text-red-500">Start time is required.</p>}
                </div>
                <div className="space-y-2">
                  <Label>
                    <Clock className="h-3 w-3 inline mr-1" />
                    End Time <span className="text-xs text-muted-foreground font-normal">(editable)</span>
                  </Label>
                  <Select value={endTime} onValueChange={setEndTime} disabled={!startTime}>
                    <SelectTrigger className={touched && !endTime ? "border-red-500" : ""}>
                      <SelectValue placeholder={startTime ? "Select end time" : "Pick start time first"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {timeSlots
                        .filter((slot) => !startTime || slot.value > startTime)
                        .map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {touched && startTime && !endTime && <p className="text-xs text-red-500">End time is required.</p>}
                </div>
              </div>
            );
          })()}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Add any additional notes or agenda items..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* CC Emails */}
          <div className="space-y-2">
            <Label>CC Emails (Optional)</Label>
            <Input
              type="text"
              value={ccEmails}
              onChange={(e) => {
                const val = e.target.value;
                setCcEmails(val);
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const invalid = val.split(",").map((e) => e.trim()).filter((e) => e && !emailRegex.test(e));
                setCcEmailsError(invalid.length > 0 ? `Invalid: ${invalid.join(", ")}` : "");
              }}
              placeholder="email1@example.com, email2@example.com"
              className={ccEmailsError ? "border-red-500" : ""}
            />
            {ccEmailsError
              ? <p className="text-xs text-red-500">{ccEmailsError}</p>
              : <p className="text-xs text-muted-foreground">Additional attendees — separate multiple with commas</p>
            }
          </div>

          {/* Preview */}
          {assignedUserId && appointmentType && selectedDate && startTime && endTime && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
              <p className="font-medium flex items-center gap-2">
                <Video className="h-4 w-4 text-blue-500" />
                {appointmentTypes.find((t) => t.id === appointmentType)?.name ?? appointmentType} — {clientName}
              </p>
              <p className="text-muted-foreground">{format(selectedDate, "EEEE, MMMM d, yyyy")} · {startTime} – {endTime}</p>
              {clientAddress && <p className="text-muted-foreground">{clientAddress}</p>}
              {client?.email && (
                <p className="text-muted-foreground flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" />
                  Invite will be sent to {client.email}
                </p>
              )}
              {assignedUserId && (() => {
                const u = teamMembers.find((m) => m.id === assignedUserId);
                return u?.email ? (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" />
                    Also sent to {u.first_name} {u.last_name} ({u.email})
                  </p>
                ) : null;
              })()}
              {/* <p className="text-xs text-blue-600">Google Meet link will be created automatically</p> */}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={scheduling || !assignedUserId || !appointmentType || !selectedDate || !startTime || !endTime || calendarConnected === false || !client?.email || !!ccEmailsError}
            className="min-w-[180px]"
          >
            <span className="flex items-center justify-center gap-2 whitespace-nowrap">
              {scheduling ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Scheduling...</>
              ) : (
                <><CalendarIcon className="h-4 w-4" />Schedule &amp; Send Invite</>
              )}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Email Preview Dialog */}
      <Dialog open={showEmailPreview} onOpenChange={setShowEmailPreview}>
        <DialogContent className="flex flex-col p-0 gap-0" style={{ width: "680px", maxWidth: "95vw", height: "85vh" }}>
          <DialogHeader className="shrink-0 px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Preview — {appointmentTypes.find((t) => t.id === appointmentType)?.name ?? "Appointment"}
            </DialogTitle>
            <DialogDescription>
              This is exactly what {client?.email || clientName} will receive.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden rounded-b-lg">
            <iframe
              srcDoc={buildPreviewHtml()}
              className="w-full h-full border-0"
              title="Email Preview"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Rep Email Preview Dialog — what the assigned rep receives */}
      <Dialog open={showRepPreview} onOpenChange={setShowRepPreview}>
        <DialogContent className="flex flex-col p-0 gap-0" style={{ width: "680px", maxWidth: "95vw", height: "85vh" }}>
          <DialogHeader className="shrink-0 px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Rep Email Preview
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const rep = teamMembers.find((m) => m.id === assignedUserId);
                return `This is what ${rep ? `${rep.first_name} ${rep.last_name}` : "the assigned rep"}${rep?.email ? ` (${rep.email})` : ""} will receive with the client's field info.`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden rounded-b-lg">
            <iframe
              srcDoc={buildRepPreviewHtml()}
              className="w-full h-full border-0"
              title="Rep Email Preview"
            />
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
