'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Image from 'next/image';
import { WalletButton } from '@/components/WalletButton';
import { RoadmapModal } from '@/components/RoadmapModal';

interface ShardItem {
  mintAddress: string;
  name: string;
  image: string;
  description: string;
  attributes: { trait_type: string; value: string }[];
}

export default function GalleryPage() {
  const { publicKey, connected } = useWallet();
  const [shards, setShards] = useState<ShardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!connected || !publicKey) {
      setShards([]);
      return;
    }

    const fetchShards = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/shards/${publicKey.toBase58()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch');
        setShards(data.shards);
      } catch (err: any) {
        setError(err.message || 'Failed to load shards');
      } finally {
        setLoading(false);
      }
    };

    fetchShards();
  }, [connected, publicKey]);

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
          <a href="/gallery" className="nav-link nav-active">Gallery</a>
          <a href="/leaderboard" className="nav-link">Leaderboard</a>
          <WalletButton />
        </nav>
      </header>

      <section className="gallery-hero fade-up">
        <h2>Your Shards</h2>
        <p>View all Commit Shard NFTs in your wallet</p>
      </section>

      {!connected && (
        <div className="gallery-empty fade-up fade-up-2">
          <span className="gallery-empty-icon">&#9670;</span>
          <p>Connect your wallet to view your shards</p>
        </div>
      )}

      {connected && loading && (
        <div className="gallery-empty fade-up">
          <div className="gallery-spinner" />
          <p>Loading your shards...</p>
        </div>
      )}

      {connected && error && (
        <div className="gallery-empty fade-up">
          <p className="error">{error}</p>
        </div>
      )}

      {connected && !loading && !error && shards.length === 0 && (
        <div className="gallery-empty fade-up fade-up-2">
          <span className="gallery-empty-icon">&#9671;</span>
          <p>No shards found in your wallet</p>
          <a href="/" className="gallery-mint-link">Mint your first shard</a>
        </div>
      )}

      {shards.length > 0 && (
        <div className="gallery-grid fade-up fade-up-2">
          {shards.map((shard) => {
            const commitAttr = shard.attributes.find(a => a.trait_type === 'Commit');
            const repoAttr = shard.attributes.find(a => a.trait_type === 'Repo');
            return (
              <a
                key={shard.mintAddress}
                href={`/shard/${shard.mintAddress}`}
                className="gallery-card"
              >
                <div className="gallery-card-image">
                  {shard.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shard.image} alt={shard.name} />
                  ) : (
                    <div className="gallery-card-placeholder">No image</div>
                  )}
                </div>
                <div className="gallery-card-info">
                  <span className="gallery-card-name">{shard.name}</span>
                  {repoAttr && (
                    <span className="gallery-card-repo">{repoAttr.value}</span>
                  )}
                  {commitAttr && (
                    <span className="gallery-card-sha">{commitAttr.value}</span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}

      <footer className="footer">
        <p>Commit Shards &mdash; built on Solana with Metaplex</p>
        <RoadmapModal />
      </footer>
    </main>
  );
}
