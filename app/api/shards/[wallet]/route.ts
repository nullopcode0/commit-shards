import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { fetchDigitalAsset, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';
import { Connection, PublicKey } from '@solana/web3.js';
import { NextResponse } from 'next/server';

const DEVNET_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

export async function GET(
  _request: Request,
  { params }: { params: { wallet: string } }
) {
  try {
    const walletKey = params.wallet;

    // Get all token accounts for this wallet
    const connection = new Connection(DEVNET_RPC);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(walletKey),
      { programId: TOKEN_PROGRAM }
    );

    // Filter for NFTs (amount = 1, decimals = 0)
    const nftMints = tokenAccounts.value
      .filter(ta => {
        const info = ta.account.data.parsed.info;
        return info.tokenAmount.uiAmount === 1 && info.tokenAmount.decimals === 0;
      })
      .map(ta => ta.account.data.parsed.info.mint as string);

    // Fetch metadata for each NFT in parallel (max 10 concurrent)
    const umi = createUmi(DEVNET_RPC).use(mplTokenMetadata());

    const batchSize = 10;
    const shards: {
      mintAddress: string;
      name: string;
      image: string;
      description: string;
      attributes: { trait_type: string; value: string }[];
    }[] = [];

    for (let i = 0; i < nftMints.length; i += batchSize) {
      const batch = nftMints.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (mint) => {
          const asset = await fetchDigitalAsset(umi, publicKey(mint));
          const name = asset.metadata.name.replace(/\0/g, '').trim();
          const symbol = asset.metadata.symbol.replace(/\0/g, '').trim();

          // Only include Commit Shard NFTs (collection symbol)
          if (symbol !== 'COMSHARD') return null;

          const uri = asset.metadata.uri;
          let image = '';
          let description = '';
          let attributes: { trait_type: string; value: string }[] = [];

          try {
            const res = await fetch(uri);
            const json = await res.json();
            image = json.image || '';
            description = json.description || '';
            attributes = json.attributes || [];
          } catch {}

          return { mintAddress: mint, name, image, description, attributes };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          shards.push(result.value);
        }
      }
    }

    return NextResponse.json({ shards });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch shards' },
      { status: 500 }
    );
  }
}
