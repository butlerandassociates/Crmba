import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "sonner";
import { Upload, AlertTriangle, CheckCircle2, Trash2, Car, FileText, X } from "lucide-react";
import { formatCurrency } from "@/app/utils/format";
import {
  parseEverlanceCSV,
  mileageTripsAPI,
  mileageSubmissionsAPI,
  type ParsedTrip,
} from "../../api/mileage";

interface Props {
  submissionId: string;
  periodLabel: string;
  ratePerMile: number;
  userId: string;
  existingTrips: { trip_date: string; end_address: string }[];
  projects: { id: string; name: string; client_id: string; client?: { address?: string; first_name: string; last_name: string } }[];
  onSaved: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function MileageUpload({ submissionId, periodLabel, ratePerMile, userId, existingTrips, projects, onSaved, onDirtyChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [trips, setTrips] = useState<ParsedTrip[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseStats, setParseStats] = useState<{ total: number; skipped: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");

  // Unsaved parsed trips = "dirty". Report up + guard browser close/refresh.
  const isDirty = trips.length > 0;
  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty]);
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a .csv file from Everlance.");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseEverlanceCSV(text, ratePerMile, existingTrips, projects);
      setTrips(result.trips);
      setParseErrors(result.errors);
      setParseStats({ total: result.totalRows, skipped: result.skippedRows });
      if (result.errors.length) toast.error(`CSV parse issue: ${result.errors[0]}`);
      else if (result.trips.length === 0) toast.warning("No valid trips found in this CSV.");
      else toast.success(`${result.trips.length} trips loaded from CSV.`);
    };
    reader.readAsText(file);
  }, [ratePerMile, existingTrips, projects]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so re-selecting the SAME file still fires onChange
    e.target.value = "";
  };

  const removeTrip = (id: string) => {
    setTrips((prev) => prev.filter((t) => t._id !== id));
  };

  const assignProject = (tripId: string, projectId: string) => {
    setTrips((prev) => prev.map((t) => {
      if (t._id !== tripId) return t;
      const proj = projects.find((p) => p.id === projectId);
      return {
        ...t,
        project_id: projectId,
        client_id: proj?.client_id ?? null,
        match_confidence: "manual" as const,
      };
    }));
  };

  const handleSave = async () => {
    const unmatchedCount = trips.filter((t) => t.match_confidence === "unmatched").length;
    if (unmatchedCount > 0) {
      toast.error(`${unmatchedCount} trip${unmatchedCount > 1 ? "s" : ""} still need a project assigned.`);
      return;
    }

    setSaving(true);
    try {
      await mileageTripsAPI.bulkInsert(
        trips.map((t) => ({
          submission_id:    submissionId,
          trip_date:        t.trip_date,
          start_address:    t.start_address,
          end_address:      t.end_address,
          miles:            t.miles,
          project_id:       t.project_id,
          client_id:        t.client_id,
          is_duplicate:     t.is_duplicate,
          match_confidence: t.match_confidence,
          payout:           t.payout,
          map_image_url:    t.map_image_url,
          is_active:        true,
          discarded_at:     null,
          discarded_by:     null,
          created_by:       userId,
          updated_by:       userId,
        }))
      );
      await mileageSubmissionsAPI.recalcTotals(submissionId, userId);
      toast.success("Trips saved to your submission.");
      setTrips([]);
      setFileName("");
      setParseStats(null);
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save trips.");
    } finally {
      setSaving(false);
    }
  };

  const totalMiles  = trips.reduce((s, t) => s + t.miles, 0);
  const totalPayout = trips.reduce((s, t) => s + t.payout, 0);
  const duplicates  = trips.filter((t) => t.is_duplicate).length;
  const unmatched   = trips.filter((t) => t.match_confidence === "unmatched").length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {trips.length === 0 && (
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="p-4 rounded-full bg-muted">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">Upload Everlance CSV</p>
              <p className="text-sm text-muted-foreground mt-1">Drag &amp; drop or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Week: {periodLabel} · Rate: ${ratePerMile}/mile</p>
            </div>
          </CardContent>
        </Card>
      )}

      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-destructive font-medium mb-2">
              <AlertTriangle className="h-4 w-4" /> CSV Parse Error
            </div>
            {parseErrors.map((e, i) => <p key={i} className="text-sm text-destructive">{e}</p>)}
          </CardContent>
        </Card>
      )}

      {/* Parse stats + summary */}
      {parseStats && trips.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{fileName}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setTrips([]); setFileName(""); setParseStats(null); setParseErrors([]); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{parseStats.total} rows parsed</span>
              {parseStats.skipped > 0 && <span className="text-amber-600">{parseStats.skipped} skipped</span>}
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold">{trips.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Trips</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold">{totalMiles.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Miles</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPayout)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Est. Payout</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${unmatched > 0 ? "bg-amber-50" : "bg-green-50"}`}>
              <p className={`text-2xl font-bold ${unmatched > 0 ? "text-amber-700" : "text-green-700"}`}>
                {unmatched > 0 ? unmatched : <CheckCircle2 className="h-7 w-7 mx-auto" />}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{unmatched > 0 ? "Need Project" : "All Matched"}</p>
            </div>
          </div>

          {/* Duplicate warning */}
          {duplicates > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span><strong>{duplicates} duplicate trip{duplicates > 1 ? "s" : ""} detected</strong> — same date + destination already submitted. Review and remove if needed.</span>
            </div>
          )}

          {/* Trips table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Car className="h-4 w-4" /> Trip Review
                <span className="text-muted-foreground font-normal">— assign any unmatched trips before saving</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Destination</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">Miles</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">Payout</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Project</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {trips.map((trip) => (
                      <tr key={trip._id} className={`hover:bg-accent/50 ${trip.is_duplicate ? "bg-amber-50/50" : ""}`}>
                        <td className="p-3 text-sm whitespace-nowrap">
                          {new Date(trip.trip_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="p-3 text-sm max-w-[200px]">
                          <p className="truncate" title={trip.end_address}>{trip.end_address}</p>
                          {trip.is_duplicate && (
                            <span className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="h-3 w-3" /> Duplicate
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-right tabular-nums">{trip.miles.toFixed(1)}</td>
                        <td className="p-3 text-sm text-right tabular-nums font-medium">{formatCurrency(trip.payout)}</td>
                        <td className="p-3 min-w-[200px]">
                          {trip.match_confidence === "auto" ? (
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">Auto</Badge>
                              <span className="text-xs truncate max-w-[150px]" title={projects.find(p => p.id === trip.project_id)?.name}>
                                {projects.find(p => p.id === trip.project_id)?.name ?? "—"}
                              </span>
                            </div>
                          ) : (
                            <Select
                              value={trip.project_id ?? ""}
                              onValueChange={(v) => assignProject(trip._id, v)}
                            >
                              <SelectTrigger className={`h-8 text-xs ${trip.match_confidence === "unmatched" ? "border-amber-400 bg-amber-50/50" : ""}`}>
                                <SelectValue placeholder="Select project…" />
                              </SelectTrigger>
                              <SelectContent>
                                {projects.map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">
                                    {p.name} {p.client ? `— ${p.client.first_name} ${p.client.last_name}` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="p-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeTrip(trip._id)}
                            title="Remove trip"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Save button */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-sm text-muted-foreground">
              {unmatched > 0
                ? `Assign ${unmatched} unmatched trip${unmatched > 1 ? "s" : ""} before saving`
                : `Ready to save ${trips.length} trips — ${formatCurrency(totalPayout)} payout`}
            </p>
            <Button onClick={handleSave} disabled={saving || unmatched > 0}>
              {saving ? "Saving…" : "Save Trips"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
