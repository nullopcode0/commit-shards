/**
 * One-time script to create the Commit Shards collection NFT on devnet.
 *
 * Usage:
 *   SOLANA_KEYPAIR='[1,2,3,...]' npx tsx scripts/create-collection.ts
 *
 * After running, set the printed COLLECTION_MINT values as env vars on Vercel.
 */
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, createNft } from '@metaplex-foundation/mpl-token-metadata';
import { generateSigner, percentAmount, keypairIdentity } from '@metaplex-foundation/umi';
import Irys from '@irys/sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const IRYS_GATEWAY = 'https://devnet.irys.xyz';

async function main() {
  // 1. Load server keypair
  const secretKeyJson = process.env.SOLANA_KEYPAIR;
  if (!secretKeyJson) {
    console.error('Set SOLANA_KEYPAIR env var (JSON array of bytes)');
    process.exit(1);
  }
  const keypairBytes = Uint8Array.from(JSON.parse(secretKeyJson.trim()));

  // 2. Upload logo as collection image to Irys
  const irys = new Irys({
    url: 'https://devnet.irys.xyz',
    token: 'solana',
    key: keypairBytes,
    config: { providerUrl: DEVNET_RPC },
  });

  const logoPath = resolve(process.cwd(), 'public/logo.png');
  const logoBuffer = readFileSync(logoPath);

  console.log('Uploading collection image to Irys...');
  const logoTx = irys.createTransaction(logoBuffer, {
    tags: [{ name: 'Content-Type', value: 'image/png' }],
  });
  await logoTx.sign();
  const logoResult = await irys.uploader.uploadTransaction(logoTx);
  const imageUri = `${IRYS_GATEWAY}/${logoResult.data.id}`;
  console.log('Image URI:', imageUri);

  // 3. Upload collection metadata JSON to Irys
  const collectionMetadata = {
    name: 'Commit Shards',
    symbol: 'COMSHARD',
    description: 'Generative crystal art from git commits on Solana',
    image: imageUri,
    external_url: 'https://shards.nullopcode.cv',
  };

  console.log('Uploading collection metadata...');
  const metaBuffer = Buffer.from(JSON.stringify(collectionMetadata), 'utf-8');
  const metaTx = irys.createTransaction(metaBuffer, {
    tags: [{ name: 'Content-Type', value: 'application/json' }],
  });
  await metaTx.sign();
  const metaResult = await irys.uploader.uploadTransaction(metaTx);
  const metadataUri = `${IRYS_GATEWAY}/${metaResult.data.id}`;
  console.log('Metadata URI:', metadataUri);

  // 4. Create collection NFT via Umi
  const umi = createUmi(DEVNET_RPC).use(mplTokenMetadata());
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(keypairBytes);
  umi.use(keypairIdentity(umiKeypair));

  const collectionMint = generateSigner(umi);

  console.log('Creating collection NFT on devnet...');
  await createNft(umi, {
    mint: collectionMint,
    name: 'Commit Shards',
    symbol: 'COMSHARD',
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(5),
    isCollection: true,
  }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });

  console.log('\n=== COLLECTION CREATED ===');
  console.log('Collection Mint:', collectionMint.publicKey);
  console.log('Authority:', umiKeypair.publicKey);
  console.log('\nSet these on Vercel:');
  console.log(`  vercel env add COLLECTION_MINT production <<< "${collectionMint.publicKey}"`);
  console.log(`  vercel env add NEXT_PUBLIC_COLLECTION_MINT production <<< "${collectionMint.publicKey}"`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
