import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { FileType } from "../api/file-types";

// Pop-up shown the moment someone picks or drops a file on a client's Notes & Files card
// (Jonathan, Oct 20 2026): "what kind of file" first, then a name that starts as the original
// file name so the common case is two clicks. The same dialog edits an existing file.

/** "Site Plan.pdf" -> { stem: "Site Plan", ext: ".pdf" } */
export function splitFileName(name: string): { stem: string; ext: string } {
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1 || name.length - i > 10) return { stem: name, ext: "" };
  return { stem: name.slice(0, i), ext: name.slice(i) };
}

/** Final file name: the typed name plus the original extension (added back if the person removed it). */
export function buildFileName(typed: string, originalName: string): string {
  const { ext } = splitFileName(originalName);
  const t = typed.trim().replace(/[\\/]+/g, "-");
  if (!t) return originalName;
  if (ext && t.toLowerCase().endsWith(ext.toLowerCase())) return t;
  return t + ext;
}

type Props = {
  open: boolean;
  mode: "upload" | "edit";
  /** the name the file arrived with (upload) or currently has (edit) */
  originalName: string;
  /** "File 2 of 5" when several files were dropped at once */
  position?: { index: number; total: number };
  types: FileType[];
  initialType?: string | null;
  saving?: boolean;
  onSave: (name: string, type: string) => void;
  /** upload: skip this file / edit: close */
  onCancel: () => void;
};

export function FileUploadDialog({ open, mode, originalName, position, types, initialType, saving, onSave, onCancel }: Props) {
  const [type, setType] = useState<string>("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setType(initialType ?? "");
    setName(splitFileName(originalName).stem);
    setError("");
  }, [open, originalName, initialType]);

  const submit = () => {
    if (!type) { setError("Choose what kind of file this is."); return; }
    if (!name.trim()) { setError("Enter a name for the file."); return; }
    onSave(buildFileName(name, originalName), type);
  };

  const { ext } = splitFileName(originalName);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onCancel(); }}>
      {/* no auto-focus: otherwise the first type chip opens with a focus ring that looks pre-selected */}
      <DialogContent className="sm:max-w-md p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="px-6 py-4 pr-12">
          <DialogTitle className="text-base">
            {mode === "upload" ? "Add file" : "Edit file"}
            {position && position.total > 1 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">File {position.index} of {position.total}</span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs flex items-center gap-1.5 min-w-0">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate" title={originalName}>
              {mode === "upload" ? "Original file name: " : "Current file name: "}{originalName}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 overflow-y-auto min-h-0">
          <div className="space-y-2">
            <Label className="text-sm">What kind of file is this?</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="File type">
              {types.map((t) => {
                const selected = type === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => { setType(t.key); setError(""); }}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="file-display-name" className="text-sm">File name</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file-display-name"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                maxLength={150}
                className="text-sm"
                placeholder="Name this file"
              />
              {ext && <span className="text-sm text-muted-foreground shrink-0">{ext}</span>}
            </div>
            <button
              type="button"
              onClick={() => setName(splitFileName(originalName).stem)}
              className="text-xs text-blue-600 hover:underline"
            >
              Use original name
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter className="px-6 py-4 flex-row justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            {mode === "upload" ? (position && position.total > 1 ? "Skip" : "Cancel") : "Cancel"}
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {mode === "upload" ? (position && position.index < position.total ? "Save and next" : "Save") : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
