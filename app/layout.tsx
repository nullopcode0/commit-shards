import type { Metadata } from 'next';
import { SolanaProviders } from '@/lib/solana/providers';
import { AuthProvider } from '@/components/AuthProvider';
import './globals.css';

const SITE_URL = 'https://shards.nullopcode.cv';

export const metadata: Metadata = {
  title: {
    default: 'Commit Shards — Generative Crystal NFTs from Git Commits',
    template: '%s | Commit Shards',
  },
  description:
    'Turn your merged GitHub PRs into unique generative crystal NFTs on Solana. Each shard is deterministically generated from your commit SHA.',
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Commit Shards — Generative Crystal NFTs from Git Commits',
    description:
      'Turn your merged GitHub PRs into unique generative crystal NFTs on Solana.',
    url: SITE_URL,
    siteName: 'Commit Shards',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Commit Shards' }],
  },
  twitter: {
    card: 'summary',
    title: 'Commit Shards',
    description:
      'Generative crystal NFTs from git commits. Mint on Solana.',
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  keywords: [
    'NFT',
    'Solana',
    'generative art',
    'git',
    'GitHub',
    'commit',
    'crystal',
    'Metaplex',
    'devnet',
    'open source',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Commit Shards',
              url: SITE_URL,
              description:
                'Turn your merged GitHub PRs into unique generative crystal NFTs on Solana.',
              applicationCategory: 'DesignApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0.05',
                priceCurrency: 'SOL',
              },
              creator: {
                '@type': 'Organization',
                name: 'Commit Shards',
                url: SITE_URL,
              },
            }),
          }}
        />
      </head>
      <body>
        <AuthProvider>
          <SolanaProviders>{children}</SolanaProviders>
        </AuthProvider>
      </body>
    </html>
  );
}
