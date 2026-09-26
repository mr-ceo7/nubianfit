import React, { useState } from 'react';

/** Avatar image, falling back to initials when there is no photo or it fails to load. */
export const ClientAvatar: React.FC<{ client: { name: string; avatar?: string }; className?: string }> = ({
  client,
  className = 'h-10 w-10 rounded-full',
}) => {
  const [failed, setFailed] = useState(false);
  const initials = client.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

  if (client.avatar && !failed) {
    return <img src={client.avatar} alt={client.name} onError={() => setFailed(true)} className={`${className} object-cover shrink-0`} />;
  }
  return (
    <div className={`${className} shrink-0 bg-emerald-500/15 text-emerald-400 font-bold text-xs flex items-center justify-center`} aria-label={client.name}>
      {initials || '?'}
    </div>
  );
};
