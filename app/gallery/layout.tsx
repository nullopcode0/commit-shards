import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gallery',
  description:
    'Browse all minted Commit Shards — generative crystal NFTs created from git commits on Solana.',
  openGraph: {
    title: 'Gallery | Commit Shards',
    description: 'Browse all minted generative crystal NFTs from git commits.',
  },
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
