'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { WalletButton } from '@/components/WalletButton';
import { RoadmapModal } from '@/components/RoadmapModal';

interface LeaderboardEntry {
  wallet: string;
  count: number;
  shards: { mintAddress: string; name: string }[];
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    fetch('/api/leaderboard')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setEntries(data.entries);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setLoading(false);
        clearInterval(timerRef.current);
      });
    return () => clearInterval(timerRef.current);
  }, []);

  return (
    <main className="container">
      <header>
        <div className="header-brand">
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', textDecoration: 'none' }}>
            <Image src="/logo.png" alt="Commit Shards" width={48} height={48} className="header-logo" />
            <div>
              <h1>COMMIT SHARDS <span className="network-badge">devnet</span></h1>
              <p className="subtitle">generative crystal art from git commits</p>
            </div>
          </a>
        </div>
        <nav className="header-nav">
          <a href="/" className="nav-link">Mint</a>
          <a href="/gallery" className="nav-link">Gallery</a>
          <a href="/leaderboard" className="nav-link nav-active">Leaderboard</a>
          <WalletButton />
        </nav>
      </header>

      <section className="gallery-hero fade-up">
        <h2>Leaderboard</h2>
        <p>{loading ? 'Loading...' : `${total} total shard${total !== 1 ? 's' : ''} minted`}</p>
      </section>

      {loading && (
        <div className="gallery-empty fade-up">
          <div className="gallery-spinner" />
          <p>Querying on-chain data... {elapsed}s</p>
          {elapsed >= 5 && (
            <p className="loading-hint">First load scans the blockchain — cached after this</p>
          )}
        </div>
      )}

      {error && (
        <div className="gallery-empty fade-up">
          <p className="error">{error}</p>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="gallery-empty fade-up fade-up-2">
          <span className="gallery-empty-icon">&#9670;</span>
          <p>No shards have been minted yet</p>
          <a href="/" className="gallery-mint-link">Mint the first shard</a>
        </div>
      )}

      {entries.length > 0 && (
        <div className="leaderboard-list fade-up fade-up-2">
          {entries.map((entry, idx) => (
            <div key={entry.wallet} className="leaderboard-row">
              <span className="leaderboard-rank">#{idx + 1}</span>
              <div className="leaderboard-info">
                <span className="leaderboard-wallet">
                  {entry.wallet.slice(0, 4)}...{entry.wallet.slice(-4)}
                </span>
                <span className="leaderboard-count">
                  {entry.count} shard{entry.count !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="leaderboard-shards">
                {entry.shards.slice(0, 5).map((s) => (
                  <a
                    key={s.mintAddress}
                    href={`/shard/${s.mintAddress}`}
                    className="leaderboard-shard-link"
                    title={s.name}
                  >
                    {s.name.replace('Shard ', '').slice(0, 8)}
                  </a>
                ))}
                {entry.shards.length > 5 && (
                  <span className="leaderboard-more">+{entry.shards.length - 5}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <footer className="footer">
        <p>Commit Shards &mdash; built on Solana with Metaplex</p>
        <RoadmapModal />
      </footer>
    </main>
  );
}
