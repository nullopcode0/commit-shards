import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description:
    'Top Commit Shards minters ranked by shard count. See who has turned the most git commits into crystal NFTs.',
  openGraph: {
    title: 'Leaderboard | Commit Shards',
    description: 'Top minters ranked by shard count.',
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
