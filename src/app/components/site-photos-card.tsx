import { useState } from "react";
import { Camera, ImageOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";

// Job site photos on the client page (Jonathan, Nov 11 2026: "give me the ability to access completed job site
// photos ... we upload these when pushing a job from active to completed but there's nowhere to review the
// records"). They were already saved as client files of type "photo", but only as one-line file names mixed into
// the Notes & Files feed. This lays them out as a thumbnail gallery; a click opens the existing full-size viewer.

const FIRST_BATCH = 12;

type Props = {
  /** the client's files (client_files rows, newest first) */
  files: any[];
  onPreview: (f: { url: string; name: string }) => void;
};

// Site photos are full-size phone pictures (4000+ px, 5-7 MB each). The grid asks Supabase Storage for a small
// square copy (~20 KB) and only the full-size viewer loads the original; if resizing isn't available for a file it
// falls back to the original, and if that can't be drawn either (e.g. HEIC) the tile links to the file.
const thumbUrl = (url: string) =>
  url.includes("/storage/v1/object/public/")
    ? `${url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=480&height=480&resize=cover&quality=70`
    : url;

// Most browsers can't open an iPhone HEIC, so its full-size view uses a 2000 px JPEG rendition; everything else opens the original.
const viewUrl = (f: any) =>
  /hei[cf]/i.test(f.mime_type ?? "") || /\.hei[cf]$/i.test(f.file_url ?? "")
    ? thumbUrl(f.file_url).replace("width=480&height=480&resize=cover", "width=2000&resize=contain")
    : f.file_url;

const isImage = (f: any) => f.mime_type?.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(f.file_url ?? "");

function Tile({ file, onPreview }: { file: any; onPreview: Props["onPreview"] }) {
  const [stage, setStage] = useState<"thumb" | "original" | "broken">("thumb");
  const broken = stage === "broken";
  const name = file.file_name ?? file.file_url?.split("/").pop() ?? "photo";
  const date = new Date(file.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const who = file.uploader?.first_name ? ` · ${file.uploader.first_name}` : "";
  return (
    <div className="min-w-0">
      {broken ? (
        <a
          href={file.file_url}
          target="_blank"
          rel="noreferrer"
          className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border bg-muted/40 px-2 text-center text-xs text-muted-foreground hover:bg-muted"
        >
          <ImageOff className="h-5 w-5" />
          <span className="line-clamp-2 break-all">Open original</span>
        </a>
      ) : (
        <button
          type="button"
          onClick={() => onPreview({ url: viewUrl(file), name })}
          className="block aspect-square w-full overflow-hidden rounded-lg border bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`View photo ${name}`}
        >
          <img
            src={stage === "thumb" ? thumbUrl(file.file_url) : file.file_url}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={() => setStage(stage === "thumb" ? "original" : "broken")}
            className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
          />
        </button>
      )}
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{date}{who}</p>
    </div>
  );
}

export function SitePhotosCard({ files, onPreview }: Props) {
  const [showAll, setShowAll] = useState(false);
  const photos = files.filter((f) => f.file_type === "photo" && isImage(f));
  if (photos.length === 0) return null;
  const visible = showAll ? photos : photos.slice(0, FIRST_BATCH);

  return (
    <Card id="site-photos" className="scroll-mt-24">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="h-4 w-4" />
          Job Site Photos
          <span className="ml-auto text-xs font-normal text-muted-foreground">{photos.length} photo{photos.length === 1 ? "" : "s"}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {visible.map((f) => <Tile key={f.id} file={f} onPreview={onPreview} />)}
        </div>
        {photos.length > FIRST_BATCH && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `Show all ${photos.length} photos`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
