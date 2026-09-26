import React from 'react';
import { videoEmbedUrl } from '../../utils/workout';

/** Responsive YouTube/Vimeo player. Renders nothing for links we can't embed. */
export const VideoEmbed: React.FC<{ url?: string | null; title: string; className?: string }> = ({ url, title, className = '' }) => {
  const src = videoEmbedUrl(url);
  if (!src) return null;
  return (
    <div className={`relative w-full aspect-video overflow-hidden rounded-xl bg-black ${className}`}>
      <iframe
        src={src}
        title={`${title} demo video`}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
};
