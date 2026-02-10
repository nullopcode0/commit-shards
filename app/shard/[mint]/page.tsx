import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';
import type { Metadata } from 'next';
import { ShardDetail } from './ShardDetail';

const DEVNET_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

interface JsonMetadata {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  attributes?: { trait_type: string; value: string }[];
  properties?: { files?: { uri: string; type: string }[] };
}

async function fetchShardData(mintAddress: string) {
  try {
    const umi = createUmi(DEVNET_RPC).use(mplTokenMetadata());
    const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
    const uri = asset.metadata.uri;

    // Fetch off-chain JSON metadata
    const res = await fetch(uri, { next: { revalidate: 3600 } });
    const json: JsonMetadata = await res.json();

    return {
      name: asset.metadata.name.replace(/\0/g, '').trim(),
      symbol: asset.metadata.symbol.replace(/\0/g, '').trim(),
      uri,
      mintAddress,
      onChain: {
        sellerFeeBasisPoints: asset.metadata.sellerFeeBasisPoints,
        updateAuthority: String(asset.metadata.updateAuthority),
      },
      json,
    };
  } catch (err: any) {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: { mint: string } }
): Promise<Metadata> {
  const data = await fetchShardData(params.mint);
  const title = data ? data.name : 'Shard Not Found';
  const description = data?.json.description || 'Generative crystal art from git commits';
  const image = data?.json.image;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Commit Shards`,
      description,
      ...(image && { images: [{ url: image, alt: title }] }),
      type: 'article',
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: `${title} | Commit Shards`,
      description,
      ...(image && { images: [image] }),
    },
  };
}

export default async function ShardPage({ params }: { params: { mint: string } }) {
  const data = await fetchShardData(params.mint);

  if (!data) {
    return (
      <main className="container">
        <div className="shard-not-found">
          <h2>Shard not found</h2>
          <p>Could not load NFT metadata for this mint address.</p>
          <a href="/" className="back-link">Back to mint</a>
        </div>
      </main>
    );
  }

  return <ShardDetail data={data} />;
}
