import { NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, verifyCollectionV1, findMetadataPda } from '@metaplex-foundation/mpl-token-metadata';
import { keypairIdentity, publicKey } from '@metaplex-foundation/umi';

const DEVNET_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const COLLECTION_MINT = process.env.COLLECTION_MINT || '66XzVHiPnnteArtAnsWjPG7445DD5rsuBJxt4h5Lv7UN';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { mintAddress } = await req.json();
    if (!mintAddress) {
      return NextResponse.json({ error: 'Missing mintAddress' }, { status: 400 });
    }

    const secretKeyJson = process.env.SOLANA_KEYPAIR;
    if (!secretKeyJson) {
      return NextResponse.json({ error: 'Server keypair not configured' }, { status: 500 });
    }

    const keypairBytes = Uint8Array.from(JSON.parse(secretKeyJson.trim()));

    const umi = createUmi(DEVNET_RPC).use(mplTokenMetadata());
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(keypairBytes);
    umi.use(keypairIdentity(umiKeypair));

    const metadata = findMetadataPda(umi, { mint: publicKey(mintAddress) });

    await verifyCollectionV1(umi, {
      metadata,
      collectionMint: publicKey(COLLECTION_MINT),
      authority: umi.identity,
    }).sendAndConfirm(umi);

    return NextResponse.json({ verified: true });
  } catch (err: any) {
    console.error('Verify collection error:', err);
    return NextResponse.json(
      { error: err.message || 'Verification failed' },
      { status: 500 },
    );
  }
}
