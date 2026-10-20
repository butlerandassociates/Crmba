import { useEffect, useMemo, useRef, useState } from "react";
import { StickyNote, FileText, Pencil, X, ChevronLeft, ChevronRight } from "lucide-react";
import { fileTypeLabel, type FileType } from "../api/file-types";

// The feed under the upload box on a client's "Notes & Files" card, redesigned as the team's single
// source of truth (Jonathan, Oct 20 2026): 8 items per page with page numbers instead of an endless scroll,
// an X to delete and a pencil to edit on every item, and the type shown with the label admins set.

export const FEED_PAGE_SIZE = 8;

const ROLE_STYLE: Record<string, string> = {
  admin: "bg-green-100 text-green-700",
  project_manager: "bg-blue-100 text-blue-700",
  sales_rep: "bg-purple-100 text-purple-700",
  foreman: "bg-orange-100 text-orange-700",
};
const ROLE_LABEL: Record<string, string> = { admin: "Admin", project_manager: "PM", sales_rep: "Sales Rep", foreman: "Foreman" };

/** Page numbers to show: always first/last, a window around the current page, "…" for gaps. */
export function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set<number>([1, total, current - 1, current, current + 1]);
  if (current <= 3) { keep.add(2); keep.add(3); keep.add(4); }
  if (current >= total - 2) { keep.add(total - 1); keep.add(total - 2); keep.add(total - 3); }
  const sorted = [...keep].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

type Props = {
  notes: any[];
  files: any[];
  fileTypes: FileType[];
  canDeleteNotes: boolean;
  canDeleteFiles: boolean;
  /** false on a closed (read-only) job: hides the pencil buttons */
  canEdit: boolean;
  onOpenNote: (note: any) => void;
  onDeleteNote: (id: string) => void;
  onPreviewFile: (f: { url: string; name: string }) => void;
  onEditFile: (file: any) => void;
  onDeleteFile: (f: { id: string; url: string; name: string }) => void;
};

export function NotesFilesFeed({ notes, files, fileTypes, canDeleteNotes, canDeleteFiles, canEdit, onOpenNote, onDeleteNote, onPreviewFile, onEditFile, onDeleteFile }: Props) {
  const [page, setPage] = useState(1);

  const items = useMemo(
    () =>
      [
        ...notes.map((n) => ({ ...n, _type: "note" as const })),
        ...files.map((f) => ({ ...f, _type: "file" as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [notes, files],
  );

  const totalPages = Math.max(1, Math.ceil(items.length / FEED_PAGE_SIZE));

  // a newly added item belongs on page 1; deleting the last item of the last page must not leave an empty page
  const prevCount = useRef(items.length);
  useEffect(() => {
    if (items.length > prevCount.current) setPage(1);
    prevCount.current = items.length;
  }, [items.length]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <StickyNote className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-sm font-medium">No notes or files yet</p>
        <p className="text-xs mt-1">Add a note or upload a file to keep track of client details.</p>
      </div>
    );
  }

  const current = Math.min(page, totalPages);
  const pageItems = items.slice((current - 1) * FEED_PAGE_SIZE, current * FEED_PAGE_SIZE);

  const byline = (person: any) =>
    person ? (
      <>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs font-medium text-foreground">{person.first_name} {person.last_name}</span>
        {person.role && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_STYLE[person.role] ?? "bg-gray-100 text-gray-600"}`}>
            {ROLE_LABEL[person.role] ?? person.role}
          </span>
        )}
      </>
    ) : (
      <>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs font-medium text-foreground">System</span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Auto</span>
      </>
    );

  const iconBtn = "shrink-0 p-1 rounded text-muted-foreground transition-colors hover:bg-muted";

  return (
    <div>
      <div>
        {pageItems.map((item) => {
          const ts = new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

          if (item._type === "note") {
            if (item.is_system_generated) {
              return (
                <div key={`note-${item.id}`} className="group cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 mb-2 hover:bg-blue-100 transition-colors flex items-start gap-2" onClick={() => onOpenNote(item)}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide mb-1">{item.content.split("\n")[0]}</p>
                    <p className="text-xs text-muted-foreground">{ts}</p>
                  </div>
                  {canDeleteNotes && (
                    <button className={`${iconBtn} hover:text-destructive`} aria-label="Delete note" title="Delete" onClick={(e) => { e.stopPropagation(); onDeleteNote(item.id); }}>
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            }
            return (
              <div key={`note-${item.id}`} className="flex gap-3 py-2.5 border-b last:border-0 cursor-pointer hover:bg-muted/40 rounded px-1 -mx-1 transition-colors" onClick={() => onOpenNote(item)}>
                <StickyNote className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.content.split("\n")[0]}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-xs text-muted-foreground">{ts}</p>
                    {byline(item.author)}
                  </div>
                </div>
                {canEdit && (
                  <button className={`${iconBtn} hover:text-foreground`} aria-label="Edit note" title="Edit" onClick={(e) => { e.stopPropagation(); onOpenNote(item); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {canDeleteNotes && (
                  <button className={`${iconBtn} hover:text-destructive`} aria-label="Delete note" title="Delete" onClick={(e) => { e.stopPropagation(); onDeleteNote(item.id); }}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          }

          const isImage = item.mime_type?.startsWith("image/");
          const isPdf = item.mime_type === "application/pdf";
          const name = item.file_name ?? item.file_url.split("/").pop() ?? "file";
          const label = fileTypeLabel(fileTypes, item.file_type);
          return (
            <div key={`file-${item.id}`} className="flex gap-3 py-2.5 border-b last:border-0">
              <FileText className={`h-3.5 w-3.5 shrink-0 mt-1 ${isPdf ? "text-red-500" : isImage ? "text-blue-500" : "text-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <button
                  className="text-sm font-medium hover:opacity-75 truncate block w-full text-left"
                  onClick={() => { if (isImage) onPreviewFile({ url: item.file_url, name }); else window.open(item.file_url, "_blank"); }}
                >
                  {name}
                </button>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {label && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{label}</span>}
                  <p className="text-xs text-muted-foreground">{ts}</p>
                  {byline(item.uploader)}
                </div>
              </div>
              {canEdit && (
                <button className={`${iconBtn} hover:text-foreground`} aria-label="Edit file" title="Edit" onClick={() => onEditFile(item)}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {canDeleteFiles && (
                <button className={`${iconBtn} hover:text-destructive`} aria-label="Delete file" title="Delete" onClick={() => onDeleteFile({ id: item.id, url: item.file_url, name })}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-1 pt-3" aria-label="Notes and files pages">
          <button
            className="h-7 w-7 inline-flex items-center justify-center rounded border text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {pageNumbers(current, totalPages).map((n, i) =>
            n === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
            ) : (
              <button
                key={n}
                onClick={() => setPage(n)}
                aria-current={n === current ? "page" : undefined}
                className={`h-7 min-w-7 px-2 rounded border text-xs ${n === current ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
              >
                {n}
              </button>
            ),
          )}
          <button
            className="h-7 w-7 inline-flex items-center justify-center rounded border text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => setPage(current + 1)} disabled={current === totalPages} aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </nav>
      )}
    </div>
  );
}
