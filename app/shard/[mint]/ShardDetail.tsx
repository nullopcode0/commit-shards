'use client';

import Image from 'next/image';
import { WalletButton } from '@/components/WalletButton';
import { ShareButtons } from '@/components/ShareButtons';
import { RoadmapModal } from '@/components/RoadmapModal';

interface ShardData {
  name: string;
  symbol: string;
  uri: string;
  mintAddress: string;
  onChain: {
    sellerFeeBasisPoints: number;
    updateAuthority: string;
  };
  json: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: { trait_type: string; value: string }[];
  };
}

export function ShardDetail({ data }: { data: ShardData }) {
  const commitAttr = data.json.attributes?.find(a => a.trait_type === 'Commit');
  const repoAttr = data.json.attributes?.find(a => a.trait_type === 'Repo');
  const authorAttr = data.json.attributes?.find(a => a.trait_type === 'Author');

  // Build GitHub PR search link if we have repo + author
  const prLink = repoAttr && authorAttr && repoAttr.value !== 'art'
    ? `https://github.com/${repoAttr.value}/pulls?q=is%3Apr+is%3Amerged+author%3A${authorAttr.value}`
    : repoAttr && repoAttr.value !== 'art'
      ? `https://github.com/${repoAttr.value}`
      : null;

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
          <a href="/leaderboard" className="nav-link">Leaderboard</a>
          <WalletButton />
        </nav>
      </header>

      <a href="/" className="back-btn">&#8592; Back to mint</a>

      <div className="detail-layout">
        {/* Art */}
        <div className="detail-art">
          {data.json.image ? (
            <div className="detail-image-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.json.image} alt={data.name} className="detail-image" />
            </div>
          ) : (
            <div className="detail-image-frame detail-no-image">
              <p>No image</p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="detail-info">
          <h1 className="detail-name">{data.name}</h1>
          <span className="detail-symbol">{data.symbol}</span>

          {data.json.description && (
            <p className="detail-description">{data.json.description}</p>
          )}

          {/* Attributes */}
          {data.json.attributes && data.json.attributes.length > 0 && (
            <div className="detail-attrs">
              <h3>Attributes</h3>
              <div className="attr-grid">
                {data.json.attributes.map(attr => (
                  <div key={attr.trait_type} className="attr-card">
                    <span className="attr-label">{attr.trait_type}</span>
                    <span className="attr-value">{attr.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          <div className="detail-links">
            <h3>Links</h3>
            <div className="link-list">
              <a
                href={`https://explorer.solana.com/address/${data.mintAddress}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="detail-link"
              >
                <span className="link-icon">&#9670;</span>
                View on Solana Explorer
              </a>

              {data.json.image && (
                <a href={data.json.image} target="_blank" rel="noopener noreferrer" className="detail-link">
                  <span className="link-icon">&#9671;</span>
                  View SVG on Arweave
                </a>
              )}

              <a href={data.uri} target="_blank" rel="noopener noreferrer" className="detail-link">
                <span className="link-icon">&#123;&#125;</span>
                View Metadata JSON
              </a>

              {prLink && (
                <a href={prLink} target="_blank" rel="noopener noreferrer" className="detail-link">
                  <span className="link-icon">&#60;&#62;</span>
                  View PRs on GitHub
                </a>
              )}
            </div>
          </div>

          {/* Share */}
          <div className="detail-share">
            <h3>Share</h3>
            <ShareButtons shardName={data.name} mintAddress={data.mintAddress} />
          </div>

          {/* On-chain details */}
          <div className="detail-onchain">
            <h3>On-chain</h3>
            <div className="onchain-row">
              <span className="onchain-label">Mint</span>
              <span className="onchain-value">{data.mintAddress.slice(0, 16)}...{data.mintAddress.slice(-8)}</span>
            </div>
            <div className="onchain-row">
              <span className="onchain-label">Authority</span>
              <span className="onchain-value">{data.onChain.updateAuthority.slice(0, 16)}...{data.onChain.updateAuthority.slice(-8)}</span>
            </div>
            <div className="onchain-row">
              <span className="onchain-label">Royalties</span>
              <span className="onchain-value">{data.onChain.sellerFeeBasisPoints / 100}%</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="footer">
        <p>Commit Shards &mdash; built on Solana with Metaplex</p>
        <RoadmapModal />
      </footer>
    </main>
  );
}
