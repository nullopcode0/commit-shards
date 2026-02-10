'use client';

import { useMemo } from 'react';

interface Props {
  shardName: string;
  mintAddress: string;
}

export function ShareButtons({ shardName, mintAddress }: Props) {
  const shareData = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://commit-shards.vercel.app';
    const url = `${base}/shard/${mintAddress}`;
    const text = `I minted ${shardName} on Commit Shards — generative crystal art from git commits on Solana`;
    return { url, text };
  }, [shardName, mintAddress]);

  const platforms = [
    {
      label: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.text)}&url=${encodeURIComponent(shareData.url)}`,
    },
    {
      label: 'Bluesky',
      href: `https://bsky.app/intent/compose?text=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`,
    },
    {
      label: 'Warpcast',
      href: `https://warpcast.com/~/compose?text=${encodeURIComponent(shareData.text)}&embeds[]=${encodeURIComponent(shareData.url)}`,
    },
    {
      label: 'Lens',
      href: `https://hey.xyz/?text=${encodeURIComponent(shareData.text)}&url=${encodeURIComponent(shareData.url)}`,
    },
  ];

  return (
    <div className="share-buttons">
      {platforms.map(p => (
        <a
          key={p.label}
          href={p.href}
          target="_blank"
          rel="noopener noreferrer"
          className="share-btn"
        >
          {p.label}
        </a>
      ))}
    </div>
  );
}
