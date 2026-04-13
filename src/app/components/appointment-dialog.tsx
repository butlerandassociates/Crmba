import { useState, useEffect } from "react";
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
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Clock, Loader2, Link as LinkIcon, LogOut, Video } from "lucide-react";
import { format } from "date-fns";
import { useGoogleCalendar } from "../hooks/use-google-calendar";
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
  const { isConnected, connect, disconnect, createEvent } = useGoogleCalendar();

  const [appointmentType, setAppointmentType] = useState("");
  const [selectedDate, setSelectedDate]       = useState<Date | undefined>();
  const [startTime, setStartTime]             = useState("");
  const [endTime, setEndTime]                 = useState("");
  const [notes, setNotes]                     = useState("");
  const [ccEmails, setCcEmails]               = useState("");
  const [scheduling, setScheduling]           = useState(false);
  const [teamMembers, setTeamMembers]           = useState<any[]>([]);
  const [assignedUserId, setAssignedUserId]     = useState("");
  const [appointmentTypes, setAppointmentTypes] = useState<any[]>([]);

  useEffect(() => {
    usersAPI.getAll().then(setTeamMembers).catch(console.error);
    supabase.from("appointment_types").select("*").eq("is_active", true).order("sort_order")
      .then(({ data }) => setAppointmentTypes(data ?? []));
  }, []);

  const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim() || client?.company || "Client";
  const clientAddress = [client?.address, client?.city, client?.state, client?.zip].filter(Boolean).join(", ");

  const handleSchedule = async () => {
    if (!appointmentType || !selectedDate || !startTime || !endTime) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!isConnected) {
      toast.error("Please connect your Google Calendar first");
      return;
    }

    try {
      setScheduling(true);

      const typeLabel = appointmentTypes.find((t) => t.id === appointmentType)?.name ?? appointmentType;

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

      const createdEvent = await createEvent({
        title: `${typeLabel} – ${clientName}`,
        startDateTime: startDT.toISOString(),
        endDateTime:   endDT.toISOString(),
        location: clientAddress || undefined,
        description: notes || `${typeLabel} with ${clientName}`,
        attendeeEmail: client?.email || undefined,
        attendeeName:  clientName,
        ccEmails: ccList,
        timeZone,
      });

      // Save to appointments table
      await appointmentsAPI.create({
        client_id:                client.id,
        title:                    `${typeLabel} – ${clientName}`,
        appointment_type:         appointmentType,
        appointment_date:         startDT.toISOString().split("T")[0], // date part
        appointment_time:         startTime,                            // "HH:MM"
        end_time:                 endTime,                              // "HH:MM"
        notes:                    notes || null,
        google_calendar_event_id: createdEvent.id,
        google_meet_link:         createdEvent.hangoutLink ?? null,
        google_event_html_link:   createdEvent.htmlLink ?? null,
        email_notification_sent:  !!client?.email,
      });

      // Log appointment scheduled
      activityLogAPI.create({
        client_id: client.id,
        action_type: "appointment_scheduled",
        description: `${typeLabel} scheduled for ${format(startDT, "MMM d, yyyy")} at ${format(startDT, "h:mm a")} – ${format(endDT, "h:mm a")}${assignedUser ? ` — assigned to ${assignedUser.first_name} ${assignedUser.last_name}` : ""}`,
      }).catch(() => {});

      // Update client record
      await clientsAPI.update(client.id, {
        appointment_scheduled: true,
        appointment_date:      startDT.toISOString(),
        appointment_end_date:  endDT.toISOString(),
      });

      // Send branded confirmation email via SendGrid
      const timeLabel = `${format(startDT, "h:mm a")} – ${format(endDT, "h:mm a")}`;
      const dateLabel = format(startDT, "EEEE, MMMM d, yyyy");
      if (client?.email) {
        supabase.functions.invoke("send-appointment-email", {
          body: {
            appointment_type_id: appointmentType,
            client_id:      client.id,
            client_name:    clientName,
            client_email:   client.email,
            client_address: clientAddress || null,
            date:           dateLabel,
            time:           timeLabel,
            meet_link:      createdEvent.hangoutLink ?? null,
          },
        }).catch((err: any) => console.error("Email send failed:", err));
      }

      // Send SMS confirmation via Twilio
      if (client?.phone) {
        supabase.functions.invoke("send-appointment-sms", {
          body: {
            client_phone:      client.phone,
            client_first_name: client.first_name ?? "",
            date:              dateLabel,
            time:              timeLabel,
          },
        }).catch((err: any) => console.error("SMS send failed:", err));
      }

      const meetLink = createdEvent.hangoutLink;
      toast.success(
        `Appointment scheduled!${client?.email ? ` Invite sent to ${client.email}.` : ""}${meetLink ? " Google Meet link created." : ""}`,
        { duration: 6000 }
      );

      if (meetLink) {
        toast.info(
          <span>
            Meet link:{" "}
            <a href={meetLink} target="_blank" rel="noopener noreferrer" className="underline font-medium">
              {meetLink}
            </a>
          </span>,
          { duration: 10000 }
        );
      }

      // Reset form
      setAppointmentType("");
      setSelectedDate(undefined);
      setStartTime("");
      setEndTime("");
      setNotes("");
      setCcEmails("");
      setAssignedUserId("");

      onOpenChange(false);
      onAppointmentScheduled?.();
    } catch (error: any) {
      console.error("Failed to schedule appointment:", error);
      toast.error(error.message || "Failed to schedule appointment");
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Schedule Appointment</DialogTitle>
          <DialogDescription>
            Schedule an appointment with {clientName} — creates a Google Calendar event with Google Meet link and emails the client automatically.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {/* Google Calendar Connection */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Google Calendar</span>
              {isConnected ? (
                <Badge className="bg-green-500 text-white text-xs">Connected</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Not connected</Badge>
              )}
            </div>
            {isConnected ? (
              <Button variant="ghost" size="sm" onClick={disconnect} className="text-muted-foreground">
                <LogOut className="h-3 w-3 mr-1" />
                Disconnect
              </Button>
            ) : (
              <Button size="sm" onClick={() => connect()}>
                <CalendarIcon className="h-3 w-3 mr-1" />
                Connect Google Calendar
              </Button>
            )}
          </div>

          {!isConnected && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
              Connect your Google Calendar to automatically create the event and send the invite to the client.
            </p>
          )}

          {/* Assigned To */}
          <div className="space-y-2">
            <Label>Assigned To *</Label>
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
          </div>

          {/* Appointment Type */}
          <div className="space-y-2">
            <Label>Appointment Type *</Label>
            <Select value={appointmentType} onValueChange={setAppointmentType}>
              <SelectTrigger>
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
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Select Date *</Label>
            <div className="border rounded-lg p-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </div>
            {selectedDate && (
              <p className="text-sm text-muted-foreground">
                <CalendarIcon className="h-3 w-3 inline mr-1" />
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </p>
            )}
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                <Clock className="h-3 w-3 inline mr-1" />
                Start Time *
              </Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>
                <Clock className="h-3 w-3 inline mr-1" />
                End Time *
              </Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

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
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
            />
            <p className="text-xs text-muted-foreground">Additional attendees — separate multiple with commas</p>
          </div>

          {/* Preview */}
          {assignedUserId && appointmentType && selectedDate && startTime && endTime && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
              <p className="font-medium flex items-center gap-2">
                <Video className="h-4 w-4 text-blue-500" />
                {appointmentTypes.find((t) => t.value === appointmentType)?.label} — {clientName}
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
              <p className="text-xs text-blue-600">Google Meet link will be created automatically</p>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={scheduling || !assignedUserId || !appointmentType || !selectedDate || !startTime || !endTime || !isConnected}
          >
            {scheduling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <CalendarIcon className="h-4 w-4 mr-2" />
                Schedule & Send Invite
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
