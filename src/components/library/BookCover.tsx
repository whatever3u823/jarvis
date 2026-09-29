import type { DocumentRecord } from "@/lib/documents";

/** Cover thumbnail rendered from page 1, or a typographic plate when there is none. */
export function BookCover({
  doc,
  size = "md",
}: {
  doc: Pick<DocumentRecord, "id" | "title" | "author" | "hasCover" | "updatedAt">;
  size?: "sm" | "md" | "lg";
}) {
  if (doc.hasCover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/documents/${doc.id}/cover?v=${encodeURIComponent(doc.updatedAt)}`}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover object-top [filter:sepia(0.28)_brightness(0.74)_contrast(1.06)_saturate(0.85)] transition-[filter] duration-500 group-hover:[filter:sepia(0.12)_brightness(0.9)_contrast(1.02)]"
      />
    );
  }
  return (
    <div className="flex h-full w-full flex-col justify-between bg-gradient-to-b from-[#1a1916] to-[#121210] p-[9%]">
      <span className="block h-px w-6 bg-brass-dim" />
      <div>
        <div
          className={`font-display leading-[1.08] text-parchment ${size === "lg" ? "text-3xl" : size === "sm" ? "text-[13px]" : "text-[17px]"}`}
          style={{ display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {doc.title}
        </div>
        {doc.author && (
          <div className={`mt-2 font-mono tracking-wider text-muted uppercase ${size === "lg" ? "text-[11px]" : "text-[8.5px]"}`}>{doc.author}</div>
        )}
      </div>
    </div>
  );
}
