import type { Metadata } from 'next';
import { SolanaProviders } from '@/lib/solana/providers';
import { AuthProvider } from '@/components/AuthProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Commit Shards',
  description: 'Mint generative crystal art from your GitHub PRs on Solana',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SolanaProviders>{children}</SolanaProviders>
        </AuthProvider>
      </body>
    </html>
  );
}
