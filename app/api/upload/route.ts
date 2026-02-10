import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import Irys from '@irys/sdk';

const DEVNET_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const IRYS_GATEWAY = 'https://devnet.irys.xyz';
const SHARD_REGISTRY_PROGRAM = new PublicKey('97Lqqtuu4bsZS6e8EacvasJe5heLbjs5pWUt1Ru83GLA');

// Max duration for serverless function
export const maxDuration = 60;

/** Derive the ShardRecord PDA from a commit SHA hex string */
function deriveShardPda(shaHex: string): PublicKey {
  const shaBytes = Buffer.from(shaHex.slice(0, 40).padEnd(40, '0'), 'hex'); // 20 bytes
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('shard'), shaBytes],
    SHARD_REGISTRY_PROGRAM,
  );
  return pda;
}

async function getIrys() {
  const secretKeyJson = process.env.SOLANA_KEYPAIR;
  if (!secretKeyJson) throw new Error('SOLANA_KEYPAIR env var not set');

  const key = JSON.parse(secretKeyJson);
  return new Irys({
    url: 'https://devnet.irys.xyz',
    token: 'solana',
    key: Uint8Array.from(key),
    config: { providerUrl: DEVNET_RPC },
  });
}

export async function POST(req: Request) {
  try {
    const { svg, metadata, sha } = await req.json();

    if (!svg || !metadata) {
      return NextResponse.json({ error: 'Missing svg or metadata' }, { status: 400 });
    }

    // SHA uniqueness check: if the ShardRecord PDA already exists, this SHA was already minted
    if (sha && sha.length >= 8) {
      const connection = new Connection(DEVNET_RPC);
      const pda = deriveShardPda(sha);
      const account = await connection.getAccountInfo(pda);
      if (account !== null) {
        return NextResponse.json(
          { error: 'This commit SHA has already been minted' },
          { status: 409 },
        );
      }
    }

    const irys = await getIrys();

    // Upload SVG image (HTTP only — no WebSocket, no fund() call)
    const svgBuffer = Buffer.from(svg, 'utf-8');
    const svgTx = irys.createTransaction(svgBuffer, {
      tags: [{ name: 'Content-Type', value: 'image/svg+xml' }],
    });
    await svgTx.sign();
    const svgResult = await irys.uploader.uploadTransaction(svgTx);

    if (svgResult.status >= 300) {
      throw new Error(`SVG upload failed with status ${svgResult.status}`);
    }

    const imageUri = `${IRYS_GATEWAY}/${svgResult.data.id}`;

    // Build full metadata with image URI
    const fullMetadata = {
      ...metadata,
      image: imageUri,
      properties: {
        ...metadata.properties,
        files: [{ uri: imageUri, type: 'image/svg+xml' }],
      },
    };

    // Upload metadata JSON
    const metaBuffer = Buffer.from(JSON.stringify(fullMetadata), 'utf-8');
    const metaTx = irys.createTransaction(metaBuffer, {
      tags: [{ name: 'Content-Type', value: 'application/json' }],
    });
    await metaTx.sign();
    const metaResult = await irys.uploader.uploadTransaction(metaTx);

    if (metaResult.status >= 300) {
      throw new Error(`Metadata upload failed with status ${metaResult.status}`);
    }

    const metadataUri = `${IRYS_GATEWAY}/${metaResult.data.id}`;

    return NextResponse.json({ imageUri, metadataUri });
  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: err.message || 'Upload failed' },
      { status: 500 },
    );
  }
}
