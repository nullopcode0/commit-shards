import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://shards.nullopcode.cv';

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/gallery`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/leaderboard`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
  ];
}
