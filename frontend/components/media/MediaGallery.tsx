"use client";

import { useState, type ReactNode } from "react";
import Icon from "@/components/icons/Icon";
import { Spinner } from "@/components/app/ui";
import type { MediaView } from "@/lib/media/view";
import AudioPlayer from "@/components/media/AudioPlayer";
import VideoPlayer from "@/components/media/VideoPlayer";

function Pending({ m }: { m: MediaView }) {
  return (
    <div className="panel-inset flex aspect-video items-center justify-center gap-3 rounded-[18px] font-body text-sm text-muted">
      {m.status === "FAILED" ? (
        <>
          <Icon name="alert" className="text-danger" /> {m.error ?? "This file couldn't be processed."}
        </>
      ) : (
        <>
          <Spinner /> Processing your {m.kind.toLowerCase()}… only you can see this until it&apos;s ready.
        </>
      )}
    </div>
  );
}

/** A post's attachments: video and audio full width, images in a grid, several items as a swipeable strip. */
export default function MediaGallery({ media, title, videoOverlay }: { media: MediaView[]; title?: string; videoOverlay?: ReactNode }) {
  const [index, setIndex] = useState(0);
  if (!media.length) return null;
  const images = media.filter((m) => m.kind === "IMAGE" && m.status === "READY");
  const onlyImages = images.length === media.length;

  if (onlyImages && images.length > 1) {
    return (
      <div className={`grid gap-1.5 overflow-hidden rounded-[18px] ${images.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {images.slice(0, 6).map((m, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={m.id} src={m.src!} alt={m.alt ?? ""} loading="lazy" className={`h-full w-full object-cover ${images.length === 3 && i === 0 ? "row-span-2" : "aspect-square"}`} />
        ))}
      </div>
    );
  }

  const current = media[Math.min(index, media.length - 1)];
  const item = (m: MediaView) =>
    m.status !== "READY" ? (
      <Pending m={m} />
    ) : m.kind === "VIDEO" ? (
      <VideoPlayer media={m} overlay={videoOverlay} />
    ) : m.kind === "AUDIO" ? (
      <AudioPlayer media={m} title={title} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={m.src!} alt={m.alt ?? ""} loading="lazy" className="max-h-[640px] w-full rounded-[18px] object-cover" style={m.width && m.height ? { aspectRatio: `${m.width}/${m.height}` } : undefined} />
    );

  if (media.length === 1) return item(current);
  return (
    <div className="space-y-2">
      {item(current)}
      <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Attachments">
        {media.map((m, i) => (
          <button key={m.id} type="button" role="tab" aria-selected={i === index} aria-label={`${m.kind.toLowerCase()} ${i + 1} of ${media.length}`} onClick={() => setIndex(i)} className={`focus-ring h-2 rounded-full transition-all ${i === index ? "w-6 bg-copper" : "w-2 bg-line-strong hover:bg-muted"}`} />
        ))}
      </div>
    </div>
  );
}
