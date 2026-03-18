import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Calendar as CalendarIcon, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  onAppointmentScheduled?: () => void;
}

const APPOINTMENT_TYPES = [
  { value: "initial", label: "Initial Appointment" },
  { value: "followup", label: "Followup Appointment" },
  { value: "presentation", label: "Presentation Appointment" },
  { value: "prewalk", label: "PreWalk Appointment" },
  { value: "finalwalk", label: "Final Walk Appointment" },
];

export function AppointmentDialog({
  open,
  onOpenChange,
  client,
  onAppointmentScheduled,
}: AppointmentDialogProps) {
  const [appointmentType, setAppointmentType] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [ccEmails, setCcEmails] = useState("");
  const [bccEmails, setBccEmails] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const handleSchedule = async () => {
    if (!appointmentType || !selectedDate || !startTime || !endTime) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setScheduling(true);

      // Get appointment type label
      const typeLabel = APPOINTMENT_TYPES.find(t => t.value === appointmentType)?.label || appointmentType;
      
      // Combine date and time
      const [startHour, startMinute] = startTime.split(':');
      const [endHour, endMinute] = endTime.split(':');
      
      const startDateTime = new Date(selectedDate);
      startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0);
      
      const endDateTime = new Date(selectedDate);
      endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0);

      // Create Google Calendar event
      const eventTitle = `${typeLabel} - ${client.name}`;
      
      // Parse CC and BCC emails
      const ccEmailsList = ccEmails.split(',').map(email => email.trim()).filter(email => email);
      const bccEmailsList = bccEmails.split(',').map(email => email.trim()).filter(email => email);
      
      // Build attendees list
      const attendees = [
        {
          email: client.email,
          displayName: client.name,
          responseStatus: "needsAction",
        },
      ];
      
      // Add CC emails (visible to all)
      ccEmailsList.forEach(email => {
        attendees.push({
          email: email,
          displayName: email,
          responseStatus: "needsAction",
        });
      });
      
      // Add BCC emails (hidden from other attendees - note: Google Calendar doesn't truly support BCC,
      // but we can add them as attendees and handle visibility server-side)
      bccEmailsList.forEach(email => {
        attendees.push({
          email: email,
          displayName: email,
          responseStatus: "needsAction",
        });
      });
      
      const googleCalendarEvent = {
        summary: eventTitle,
        location: client.address,
        description: notes || `${typeLabel} with ${client.name}`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        attendees: attendees,
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 1 day before
            { method: "popup", minutes: 60 }, // 1 hour before
          ],
        },
      };

      // Call Google Calendar API
      const response = await fetch('/api/google-calendar/create-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: googleCalendarEvent,
          clientId: client.id,
          appointmentType,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
          ccEmails: ccEmailsList,
          bccEmails: bccEmailsList,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create calendar event');
      }

      const result = await response.json();

      toast.success(`Appointment scheduled! Calendar invite sent to ${client.email}`);
      
      // Reset form
      setAppointmentType("");
      setSelectedDate(undefined);
      setStartTime("");
      setEndTime("");
      setNotes("");
      setCcEmails("");
      setBccEmails("");
      
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Appointment</DialogTitle>
          <DialogDescription>
            Schedule an appointment with {client?.name} and send a Google Calendar invite
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Appointment Type */}
          <div className="space-y-2">
            <Label htmlFor="appointment-type">Appointment Type *</Label>
            <Select value={appointmentType} onValueChange={setAppointmentType}>
              <SelectTrigger id="appointment-type">
                <SelectValue placeholder="Select appointment type" />
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
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
                className="rounded-md"
              />
            </div>
            {selectedDate && (
              <p className="text-sm text-muted-foreground">
                <CalendarIcon className="h-3 w-3 inline mr-1" />
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </p>
            )}
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">
                <Clock className="h-3 w-3 inline mr-1" />
                Start Time *
              </Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">
                <Clock className="h-3 w-3 inline mr-1" />
                End Time *
              </Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="appointment-notes">Notes (Optional)</Label>
            <Textarea
              id="appointment-notes"
              placeholder="Add any additional notes or agenda items..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* CC Emails */}
          <div className="space-y-2">
            <Label htmlFor="cc-emails">CC Emails (Optional)</Label>
            <Input
              id="cc-emails"
              type="text"
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
            />
            <p className="text-xs text-muted-foreground">
              Add additional attendees (visible to all). Separate multiple emails with commas.
            </p>
          </div>

          {/* BCC Emails */}
          <div className="space-y-2">
            <Label htmlFor="bcc-emails">BCC Emails (Optional)</Label>
            <Input
              id="bcc-emails"
              type="text"
              value={bccEmails}
              onChange={(e) => setBccEmails(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
            />
            <p className="text-xs text-muted-foreground">
              Add hidden attendees (not visible to other guests). Separate multiple emails with commas.
            </p>
          </div>

          {/* Client Info Preview */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="text-sm font-medium">Appointment Details</h4>
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Client:</span> {client?.name}</p>
              <p><span className="text-muted-foreground">Email:</span> {client?.email}</p>
              <p><span className="text-muted-foreground">Location:</span> {client?.address}</p>
              {ccEmails && (
                <p><span className="text-muted-foreground">CC:</span> {ccEmails}</p>
              )}
              {bccEmails && (
                <p><span className="text-muted-foreground">BCC:</span> {bccEmails}</p>
              )}
              {appointmentType && selectedDate && startTime && (
                <>
                  <p className="pt-2 font-medium">
                    {APPOINTMENT_TYPES.find(t => t.value === appointmentType)?.label} - {client?.name}
                  </p>
                  <p className="text-muted-foreground">
                    {format(selectedDate, "EEEE, MMMM d, yyyy")} at {startTime}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={scheduling || !appointmentType || !selectedDate || !startTime || !endTime}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}