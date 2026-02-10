'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSession, signIn } from 'next-auth/react';
import { mintShard, mintShardBatch } from '@/lib/solana/mint';
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
      // Phase 1: Parallel uploads — all metadata goes to Irys at once
      setProgress(`Uploading ${items.length} shard${items.length > 1 ? 's' : ''}...`);

      const uploadPayloads = items.map((item) => {
        const svg = generateShardSVG(item.config);
        const traits = extractShardTraits(item.config);
        const isVerifiedAuthor = !!(githubUsername && item.config.author &&
          githubUsername.toLowerCase() === item.config.author.toLowerCase());

        return {
          svg,
          sha: item.config.commitSha,
          isVerifiedAuthor,
          metadata: {
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
          },
        };
      });

      const uploadResults = await Promise.all(
        uploadPayloads.map(async (payload) => {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ svg: payload.svg, metadata: payload.metadata, sha: payload.sha }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Upload failed');
          }
          return res.json();
        })
      );

      // Phase 2: Batch mint — single wallet popup for all transactions
      const shards = uploadResults.map((r, i) => ({
        metadataUri: r.metadataUri,
        name: items[i].name,
      }));

      let minted: MintResult[];

      if (shards.length === 1) {
        setProgress('Minting...');
        const result = await mintShard(wallet.wallet.adapter, shards[0].metadataUri, shards[0].name);
        minted = [{ name: shards[0].name, mintAddress: String(result.mintAddress) }];
      } else {
        setProgress(`Approve batch mint (${shards.length} shards)...`);
        const batchResults = await mintShardBatch(wallet.wallet.adapter, shards);
        minted = batchResults.map((r, i) => ({
          name: shards[i].name,
          mintAddress: String(r.mintAddress),
        }));
      }

      setResults(minted);

      // Phase 3: Fire-and-forget verify calls for all minted shards
      minted.forEach((result, i) => {
        fetch('/api/verify-shard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mintAddress: result.mintAddress,
            sha: items[i].config.commitSha,
            repo: items[i].config.repo,
            author: items[i].config.author || '',
            githubVerified: uploadPayloads[i].isVerifiedAuthor,
          }),
        }).catch(() => {});
      });

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
