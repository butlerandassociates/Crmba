import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Users, FolderOpen } from "lucide-react";
import { ForemanPaymentBreakdown } from "./foreman-payment-breakdown";

interface CrewPaymentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
}

export function CrewPaymentSheet({ open, onOpenChange, client, project }: CrewPaymentSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Crew Payment Breakdown
          </SheetTitle>
          <SheetDescription className="text-xs">
            {client?.first_name} {client?.last_name}
            {project?.foremanName && ` · Foreman: ${project.foremanName}`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">
          {project?.id ? (
            <ForemanPaymentBreakdown project={project} />
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
              <FolderOpen className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">No project linked yet</p>
              <p className="text-xs mt-1">A project must be created for this client first.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
