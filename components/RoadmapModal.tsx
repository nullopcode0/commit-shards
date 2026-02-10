'use client';

import { useState } from 'react';

const ROADMAP_ITEMS = [
  {
    status: 'live',
    title: 'Devnet Launch',
    description: 'Mint generative crystal NFTs from your GitHub PRs on Solana devnet for 0.05 SOL',
  },
  {
    status: 'live',
    title: 'Social Sharing',
    description: 'Share your minted shards to X, Bluesky, Warpcast, and Lens',
  },
  {
    status: 'live',
    title: 'Leaderboard',
    description: 'See who has minted the most shards across all wallets',
  },
  {
    status: 'next',
    title: 'Mainnet Deployment',
    description: 'Launch on Solana mainnet with permanent on-chain storage via Arweave',
  },
  {
    status: 'next',
    title: 'USDC Payments via x402',
    description: 'Pay $5 USDC per mint using the x402 HTTP payment protocol — no SOL needed',
  },
  {
    status: 'live',
    title: 'Collection NFT',
    description: 'All shards grouped under a verified Metaplex collection (COMSHARD) for discoverability',
  },
  {
    status: 'planned',
    title: 'Rarity Traits',
    description: 'On-chain rarity scoring based on commit SHA entropy, crystal geometry, and color palette',
  },
];

export function RoadmapModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="roadmap-trigger" onClick={() => setOpen(true)}>
        Roadmap
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Roadmap</h2>
              <button className="modal-close" onClick={() => setOpen(false)}>
                &#10005;
              </button>
            </div>

            <div className="roadmap-list">
              {ROADMAP_ITEMS.map((item) => (
                <div key={item.title} className={`roadmap-item roadmap-${item.status}`}>
                  <span className={`roadmap-badge roadmap-badge-${item.status}`}>
                    {item.status === 'live' ? 'Live' : item.status === 'next' ? 'Next' : 'Planned'}
                  </span>
                  <div className="roadmap-item-info">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
