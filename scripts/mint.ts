/**
 * Commit Shards — Devnet NFT Minter
 *
 * Uploads SVGs to Irys devnet (free with devnet SOL) and
 * mints NFTs via Metaplex Token Metadata on Solana devnet.
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createNft,
  mplTokenMetadata,
} from '@metaplex-foundation/mpl-token-metadata';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import {
  keypairIdentity,
  generateSigner,
  percentAmount,
  publicKey,
  createGenericFile,
} from '@metaplex-foundation/umi';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── CONFIG ─────────────────────────────────────────────────────────────

const DEVNET_RPC = 'https://api.devnet.solana.com';
const KEYPAIR_PATH =
  process.env.KEYPAIR_PATH || join(homedir(), '.config/solana/id.json');
const OWNER = 'GzUzzfuv9fWd4sstFHf9BP3KQFTbh4RW3YcpbRAzZ79a'; // nullopcode.sol
const OUTPUT_DIR = join(__dirname, '..', 'output');

// Commit metadata for the generated shards
const COMMITS: Record<
  string,
  { sha: string; repo: string; title: string; author: string }
> = {
  e6be6597: {
    sha: 'e6be659721a6295cd5406462f9eae3532b8adb95',
    repo: 'anza-xyz/agave',
    title:
      'cli: remove ConnectionCache::new_quic_for_tests from ping command',
    author: 'nullopcode0',
  },
  '975d0c3f': {
    sha: '975d0c3f38a69154c374ce6a95ae577394f05bf1',
    repo: 'anza-xyz/agave',
    title:
      'cli: remove ConnectionCache::new_quic_for_tests from program deploy',
    author: 'nullopcode0',
  },
  '2bab970b': {
    sha: '2bab970b57334995d86719fa3a7fbbba621c7116',
    repo: 'anza-xyz/agave',
    title:
      'cli: remove ConnectionCache::new_quic_for_tests from program_v4',
    author: 'nullopcode0',
  },
};

// ─── MAIN ───────────────────────────────────────────────────────────────

async function main() {
  console.log('🔮 Commit Shards — Devnet Minter\n');

  // 1. Set up Umi with devnet + Irys uploader
  const umi = createUmi(DEVNET_RPC)
    .use(mplTokenMetadata())
    .use(irysUploader());

  // 2. Load keypair
  const secretKeyArray = JSON.parse(readFileSync(KEYPAIR_PATH, 'utf-8'));
  const keypair = umi.eddsa.createKeypairFromSecretKey(
    new Uint8Array(secretKeyArray)
  );
  umi.use(keypairIdentity(keypair));

  console.log(`Payer:  ${keypair.publicKey}`);
  console.log(`Owner:  ${OWNER}`);

  // Check balance
  const balance = await umi.rpc.getBalance(keypair.publicKey);
  const solBalance =
    Number(balance.basisPoints) / 1_000_000_000;
  console.log(`Balance: ${solBalance.toFixed(4)} SOL\n`);

  if (solBalance < 0.05) {
    console.error(
      'Low balance! Need at least ~0.05 SOL for uploads + mints.'
    );
    console.error('Run: solana airdrop 1 --url devnet');
    process.exit(1);
  }

  // 3. Find SVG files
  const svgFiles = readdirSync(OUTPUT_DIR)
    .filter((f) => f.endsWith('.svg'))
    .sort();

  if (svgFiles.length === 0) {
    console.error('No SVGs found in output/. Run `npm run generate` first.');
    process.exit(1);
  }

  console.log(`Found ${svgFiles.length} shards to mint\n`);

  const minted: { file: string; mint: string; uri: string }[] = [];

  for (const svgFile of svgFiles) {
    const shortSha = svgFile.replace('shard-', '').replace('.svg', '');
    const commit = COMMITS[shortSha];

    console.log(`--- ${svgFile} ---`);

    // Upload SVG image
    const svgBuffer = readFileSync(join(OUTPUT_DIR, svgFile));
    const genericFile = createGenericFile(
      new Uint8Array(svgBuffer),
      svgFile,
      { contentType: 'image/svg+xml' }
    );

    console.log('  Uploading SVG to Irys devnet...');
    const [imageUri] = await umi.uploader.upload([genericFile]);
    console.log(`  Image: ${imageUri}`);

    // Build metadata
    const metadata = {
      name: `Commit Shard — ${shortSha}`,
      symbol: 'SHARD',
      description: commit
        ? `Crystal shard from ${commit.repo} commit ${commit.sha.slice(0, 8)}. "${commit.title}" by ${commit.author}. Geometry, colors, and animations are deterministically derived from the commit SHA.`
        : `Generative crystal shard derived from commit ${shortSha}.`,
      image: imageUri,
      animation_url: imageUri,
      external_url: commit
        ? `https://github.com/${commit.repo}/commit/${commit.sha}`
        : undefined,
      attributes: [
        { trait_type: 'Commit SHA', value: commit?.sha || shortSha },
        { trait_type: 'Repository', value: commit?.repo || 'unknown' },
        ...(commit?.author
          ? [{ trait_type: 'Author', value: commit.author }]
          : []),
        { trait_type: 'Generator', value: 'v2-crystal' },
      ],
    };

    console.log('  Uploading metadata...');
    const metadataUri = await umi.uploader.uploadJson(metadata);
    console.log(`  Metadata: ${metadataUri}`);

    // Mint NFT
    const mint = generateSigner(umi);
    console.log('  Minting NFT...');
    await createNft(umi, {
      mint,
      name: metadata.name,
      symbol: 'SHARD',
      uri: metadataUri,
      sellerFeeBasisPoints: percentAmount(5),
      tokenOwner: publicKey(OWNER),
    }).sendAndConfirm(umi);

    console.log(`  ✅ Mint: ${mint.publicKey}\n`);
    minted.push({
      file: svgFile,
      mint: mint.publicKey.toString(),
      uri: metadataUri,
    });
  }

  // Summary
  console.log('═══════════════════════════════════════');
  console.log(`Minted ${minted.length} Commit Shards on devnet!\n`);
  for (const m of minted) {
    console.log(`  ${m.file}`);
    console.log(`    Mint: ${m.mint}`);
    console.log(`    URI:  ${m.uri}`);
  }
  console.log(`\nOwner: ${OWNER} (nullopcode.sol)`);
  console.log(
    'View on explorer: https://explorer.solana.com/address/<MINT>?cluster=devnet'
  );
}

main().catch((err) => {
  console.error('\nMinting failed:', err);
  process.exit(1);
});
