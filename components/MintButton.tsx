'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSession, signIn } from 'next-auth/react';
import { mintShard } from '@/lib/solana/mint';
import { generateShardSVG, extractShardTraits, type ShardConfig } from '@/lib/shard-generator';
import { ShareButtons } from '@/components/ShareButtons';

interface MintItem {
  config: ShardConfig;
  name: string;
}

interface Props {
  items: MintItem[];
}

interface MintResult {
  name: string;
  mintAddress: string;
}

export function MintButton({ items }: Props) {
  const wallet = useWallet();
  const { data: session } = useSession();
  const githubUsername = (session as any)?.githubUsername as string | undefined;
  const [minting, setMinting] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<MintResult[]>([]);
  const [error, setError] = useState('');

  const totalCost = items.length * 0.05;

  const handleMint = async () => {
    if (!wallet.connected || !wallet.wallet) return;
    setMinting(true);
    setError('');
    setResults([]);

    try {
      const minted: MintResult[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Upload SVG + metadata to Irys via API route
        setProgress(`Uploading ${i + 1}/${items.length}...`);
        const svg = generateShardSVG(item.config);
        const traits = extractShardTraits(item.config);
        // Only mark as verified if the OAuth user matches the PR author
        const isVerifiedAuthor = !!(githubUsername && item.config.author &&
          githubUsername.toLowerCase() === item.config.author.toLowerCase());

        const metadata = {
          name: item.name,
          symbol: 'COMSHARD',
          description: `Commit Shard — generative crystal art from ${item.config.commitSha.slice(0, 8)}`,
          attributes: [
            { trait_type: 'Commit', value: item.config.commitSha.slice(0, 8) },
            { trait_type: 'Repo', value: item.config.repo },
            ...(item.config.author ? [{ trait_type: 'Author', value: item.config.author }] : []),
            ...(isVerifiedAuthor ? [{ trait_type: 'GitHub Verified', value: githubUsername }] : []),
            ...traits,
          ],
        };

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ svg, metadata, sha: item.config.commitSha }),
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || 'Upload failed');
        }

        const { metadataUri } = await uploadRes.json();

        // Mint NFT (user signs wallet tx)
        setProgress(`Minting ${i + 1}/${items.length}...`);
        const result = await mintShard(wallet.wallet.adapter, metadataUri, item.name);
        const mintAddr = String(result.mintAddress);
        minted.push({ name: item.name, mintAddress: mintAddr });

        // Verify collection + creator + register on-chain attributes (non-blocking)
        fetch('/api/verify-shard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mintAddress: mintAddr,
            sha: item.config.commitSha,
            repo: item.config.repo,
            author: item.config.author || '',
            githubVerified: isVerifiedAuthor,
          }),
        }).catch(() => {}); // fire-and-forget
      }

      setResults(minted);
      setProgress('');
    } catch (err: any) {
      setError(err.message || 'Mint failed');
      setProgress('');
    } finally {
      setMinting(false);
    }
  };

  if (!wallet.connected) {
    return <p className="hint">Connect your wallet to mint</p>;
  }

  if (items.length === 0) {
    return <p className="hint">Select at least one shard to mint</p>;
  }

  return (
    <div className="mint-section">
      {results.length === 0 && (
        <>
          {!session && (
            <p className="hint">
              <button className="github-login-link" onClick={() => signIn('github')}>
                Sign in with GitHub
              </button>{' '}
              to get verified creator status on your shards
            </p>
          )}
          <button
            className="mint-btn"
            onClick={handleMint}
            disabled={minting}
          >
            {minting ? progress : `Mint ${items.length} shard${items.length > 1 ? 's' : ''} for ${totalCost} SOL`}
          </button>
        </>
      )}

      {error && <p className="error">{error}</p>}

      {results.length > 0 && (
        <div className="mint-results">
          <h3>Minted!</h3>
          {results.map(r => (
            <div key={r.mintAddress} className="mint-result">
              <div className="mint-result-top">
                <span>{r.name}</span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <a href={`/shard/${r.mintAddress}`}>
                    View Shard
                  </a>
                  <a
                    href={`https://explorer.solana.com/address/${r.mintAddress}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Explorer
                  </a>
                </div>
              </div>
              <ShareButtons shardName={r.name} mintAddress={r.mintAddress} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
