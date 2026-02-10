'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Image from 'next/image';
import { WalletButton } from '@/components/WalletButton';
import { GitHubInput } from '@/components/GitHubInput';
import { PRList } from '@/components/PRList';
import { ShardPreview } from '@/components/ShardPreview';
import { MintButton } from '@/components/MintButton';
import type { PRData } from '@/lib/github';
import type { ShardConfig } from '@/lib/shard-generator';
import { RoadmapModal } from '@/components/RoadmapModal';

type Mode = 'choose' | 'github' | 'art';

export default function Home() {
  const { publicKey } = useWallet();
  const [mode, setMode] = useState<Mode>('choose');
  const [prs, setPRs] = useState<PRData[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [artSha, setArtSha] = useState('');
  const [searchedUser, setSearchedUser] = useState('');

  const handlePRsLoaded = useCallback((loadedPRs: PRData[], username: string) => {
    setPRs(loadedPRs);
    setSearchedUser(username);
    setMode('github');
  }, []);

  const handleArtOnly = useCallback(() => {
    const sha = publicKey
      ? publicKey.toBase58().replace(/[^0-9a-f]/gi, '').slice(0, 40).padEnd(40, '0')
      : crypto.getRandomValues(new Uint8Array(20))
          .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
    setArtSha(sha);
    setMode('art');
  }, [publicKey]);

  const randomize = useCallback(() => {
    const sha = crypto.getRandomValues(new Uint8Array(20))
      .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
    setArtSha(sha);
  }, []);

  const togglePR = useCallback((idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const back = useCallback(() => {
    setMode('choose');
    setPRs([]);
    setSelected(new Set());
    setArtSha('');
    setSearchedUser('');
  }, []);

  const mintItems = mode === 'github'
    ? Array.from(selected).map(i => {
        const pr = prs[i];
        return {
          config: { commitSha: pr.sha, repo: pr.repo, title: pr.title, author: searchedUser } as ShardConfig,
          name: `Shard ${pr.sha.slice(0, 8)}`,
        };
      })
    : mode === 'art' && artSha
      ? [{ config: { commitSha: artSha, repo: 'art' } as ShardConfig, name: `Shard ${artSha.slice(0, 8)}` }]
      : [];

  const previewConfig: ShardConfig | null =
    mode === 'github' && selected.size > 0
      ? (() => {
          const idx = Array.from(selected)[selected.size - 1];
          const pr = prs[idx];
          return { commitSha: pr.sha, repo: pr.repo, title: pr.title };
        })()
      : mode === 'art' && artSha
        ? { commitSha: artSha, repo: 'art' }
        : null;

  return (
    <main className="container">
      <header>
        <div className="header-brand">
          <Image src="/logo.png" alt="Commit Shards" width={48} height={48} className="header-logo" />
          <div>
            <h1>COMMIT SHARDS <span className="network-badge">devnet</span></h1>
            <p className="subtitle">generative crystal art from git commits</p>
          </div>
        </div>
        <nav className="header-nav">
          <a href="/" className="nav-link nav-active">Mint</a>
          <a href="/gallery" className="nav-link">Gallery</a>
          <a href="/leaderboard" className="nav-link">Leaderboard</a>
          <WalletButton />
        </nav>
      </header>

      {mode === 'choose' && (
        <>
          <section className="hero fade-up">
            <h2>Turn your <strong>merged PRs</strong> into<br />unique crystal NFTs</h2>
            <p>Each shard is deterministically generated from your commit SHA — the same hash always produces the same art. Mint on Solana for 0.05 SOL.</p>
          </section>

          <div className="features fade-up fade-up-2">
            <div className="feature-card">
              <span className="feature-icon">{`{ }`}</span>
              <h3>From Your Code</h3>
              <p>Enter your GitHub username to find your merged PRs and mint them as crystal shards</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">{`<>`}</span>
              <h3>Deterministic Art</h3>
              <p>Same commit SHA always generates the same crystal — animated with lightning, particles, and glow</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">{`/>`}</span>
              <h3>On-chain Forever</h3>
              <p>SVG art and metadata stored on Arweave via Irys. NFT minted as a Metaplex token on Solana</p>
            </div>
          </div>

          <div className="fade-up fade-up-3">
            <GitHubInput onPRsLoaded={handlePRsLoaded} onArtOnly={handleArtOnly} />
          </div>
        </>
      )}

      {mode !== 'choose' && (
        <button className="back-btn" onClick={back}>
          &#8592; Back
        </button>
      )}

      {mode === 'github' && prs.length > 0 && (
        <PRList prs={prs} selected={selected} onToggle={togglePR} />
      )}

      {mode === 'art' && (
        <div className="art-controls">
          <button onClick={randomize}>Randomize</button>
          <span className="sha-display">{artSha.slice(0, 8)}...</span>
        </div>
      )}

      {previewConfig && (
        <div className="preview-area">
          {mode === 'github'
            ? Array.from(selected).map(i => {
                const pr = prs[i];
                return (
                  <ShardPreview
                    key={pr.sha}
                    config={{ commitSha: pr.sha, repo: pr.repo, title: pr.title }}
                  />
                );
              })
            : <ShardPreview config={previewConfig} />
          }
        </div>
      )}

      <MintButton items={mintItems} />

      <footer className="footer">
        <p>Commit Shards &mdash; built on Solana with Metaplex</p>
        <RoadmapModal />
      </footer>
    </main>
  );
}
