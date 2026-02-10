import { NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplTokenMetadata,
  verifyCollectionV1,
  verifyCreatorV1,
  findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import { keypairIdentity, publicKey } from '@metaplex-foundation/umi';
import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from '@solana/web3.js';

const DEVNET_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const COLLECTION_MINT = process.env.COLLECTION_MINT || '66XzVHiPnnteArtAnsWjPG7445DD5rsuBJxt4h5Lv7UN';
const SHARD_REGISTRY_PROGRAM_ID = new PublicKey('97Lqqtuu4bsZS6e8EacvasJe5heLbjs5pWUt1Ru83GLA');

export const maxDuration = 30;

/** Derive ShardRecord PDA from hex SHA */
function deriveShardPda(shaHex: string): [PublicKey, number] {
  const shaBytes = Buffer.from(shaHex.slice(0, 40).padEnd(40, '0'), 'hex');
  return PublicKey.findProgramAddressSync(
    [Buffer.from('shard'), shaBytes],
    SHARD_REGISTRY_PROGRAM_ID,
  );
}

function getServerKeypair(): Uint8Array {
  const secretKeyJson = process.env.SOLANA_KEYPAIR;
  if (!secretKeyJson) throw new Error('Server keypair not configured');
  return Uint8Array.from(JSON.parse(secretKeyJson.trim()));
}

export async function POST(req: Request) {
  try {
    const { mintAddress, sha, repo, author, githubVerified } = await req.json();
    if (!mintAddress) {
      return NextResponse.json({ error: 'Missing mintAddress' }, { status: 400 });
    }

    const keypairBytes = getServerKeypair();
    const results: Record<string, boolean> = {};

    // 1. Verify collection membership (Metaplex)
    try {
      const umi = createUmi(DEVNET_RPC).use(mplTokenMetadata());
      const umiKeypair = umi.eddsa.createKeypairFromSecretKey(keypairBytes);
      umi.use(keypairIdentity(umiKeypair));

      const metadata = findMetadataPda(umi, { mint: publicKey(mintAddress) });

      await verifyCollectionV1(umi, {
        metadata,
        collectionMint: publicKey(COLLECTION_MINT),
        authority: umi.identity,
      }).sendAndConfirm(umi);
      results.collection = true;
    } catch (err: any) {
      console.error('Collection verify failed:', err.message);
      results.collection = false;
    }

    // 2. Verify server wallet as creator (Metaplex)
    try {
      const umi = createUmi(DEVNET_RPC).use(mplTokenMetadata());
      const umiKeypair = umi.eddsa.createKeypairFromSecretKey(keypairBytes);
      umi.use(keypairIdentity(umiKeypair));

      const metadata = findMetadataPda(umi, { mint: publicKey(mintAddress) });

      await verifyCreatorV1(umi, {
        metadata,
        authority: umi.identity,
      }).sendAndConfirm(umi);
      results.creator = true;
    } catch (err: any) {
      console.error('Creator verify failed:', err.message);
      results.creator = false;
    }

    // 3. Register shard on-chain (Anchor program)
    if (sha && repo && author) {
      try {
        const connection = new Connection(DEVNET_RPC, 'confirmed');
        const serverKeypair = Keypair.fromSecretKey(keypairBytes);

        const shaBytes = Buffer.from(sha.slice(0, 40).padEnd(40, '0'), 'hex');
        const [shardPda] = deriveShardPda(sha);

        // Build the register_shard instruction manually using discriminator + borsh
        const discriminator = Buffer.from([
          64, 211, 164, 90, 180, 126, 62, 49, // sha256("global:register_shard")[:8]
        ]);

        // Encode args: sha([u8;20]) + repo(string) + author(string) + github_verified(bool)
        const repoBytes = Buffer.from(repo.slice(0, 64));
        const authorBytes = Buffer.from(author.slice(0, 40));

        const data = Buffer.concat([
          discriminator,
          shaBytes,                                                     // sha: [u8; 20]
          Buffer.from(new Uint32Array([repoBytes.length]).buffer),      // repo len
          repoBytes,                                                    // repo data
          Buffer.from(new Uint32Array([authorBytes.length]).buffer),    // author len
          authorBytes,                                                  // author data
          Buffer.from([githubVerified ? 1 : 0]),                       // github_verified
        ]);

        const ix = {
          programId: SHARD_REGISTRY_PROGRAM_ID,
          keys: [
            { pubkey: serverKeypair.publicKey, isSigner: true, isWritable: true },  // authority
            { pubkey: new PublicKey(mintAddress), isSigner: false, isWritable: false }, // mint
            { pubkey: shardPda, isSigner: false, isWritable: true },                // shard_record
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
          ],
          data,
        };

        const tx = new Transaction().add(ix);
        tx.feePayer = serverKeypair.publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.sign(serverKeypair);

        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, 'confirmed');

        results.registry = true;
      } catch (err: any) {
        console.error('Shard registry failed:', err.message);
        results.registry = false;
      }
    }

    return NextResponse.json({ verified: results });
  } catch (err: any) {
    console.error('Verify shard error:', err);
    return NextResponse.json(
      { error: err.message || 'Verification failed' },
      { status: 500 },
    );
  }
}
