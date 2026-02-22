/**
 * BCH Pay — Contract Preview Script
 *
 * Compiles and previews all CashScript contract addresses using dummy keys.
 * This is a dev/demo tool only — in production, contract instances are
 * created dynamically by the API with real user wallet keys.
 *
 * Usage:
 *   npx tsx src/deploy.ts             # Preview with network balance queries
 *   npx tsx src/deploy.ts --dry-run   # Preview addresses only (no network)
 *   npm run deploy
 *   npm run deploy:dry
 */

import 'dotenv/config';
import {
  ElectrumNetworkProvider,
  MockNetworkProvider,
  Contract,
  type NetworkProvider,
} from 'cashscript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARTIFACTS_DIR = path.resolve(__dirname, '..', 'artifacts');

const NETWORK = (process.env.NETWORK as 'chipnet' | 'mainnet') || 'chipnet';
const DRY_RUN = process.argv.includes('--dry-run');

// Dummy 20-byte public key hash for previewing contract addresses.
// Real PKHs come from user wallets at runtime via the API.
const DUMMY_PKH = '0000000000000000000000000000000000000000';

function loadArtifact(name: string): object {
  const artifactPath = path.join(ARTIFACTS_DIR, `${name}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Artifact not found: ${artifactPath}\nRun "npm run compile" first.`
    );
  }
  return JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
}

async function getBalanceWithTimeout(contract: Contract, timeoutMs = 10_000): Promise<bigint | null> {
  try {
    return await Promise.race([
      contract.getBalance(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      ),
    ]);
  } catch {
    return null;
  }
}

interface ContractDef {
  name: string;
  artifact: string;
  args: Array<string | bigint>;
  description: string;
}

async function main(): Promise<void> {
  console.log('========================================');
  console.log('  BCH Pay — Contract Preview');
  console.log(`  Network: ${NETWORK}${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log('========================================');
  console.log('\nNOTE: Using dummy keys. These addresses are for preview only.');
  console.log('Real contract instances are created by the API with actual user keys.\n');

  const provider = DRY_RUN
    ? new MockNetworkProvider()
    : new ElectrumNetworkProvider(NETWORK);

  const contracts: ContractDef[] = [
    {
      name: 'PaymentGateway',
      artifact: 'payment-gateway',
      args: [DUMMY_PKH],
      description: 'Forwards BCH payments to a merchant',
    },
    {
      name: 'Escrow',
      artifact: 'escrow',
      args: [DUMMY_PKH, DUMMY_PKH, DUMMY_PKH, BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60)],
      description: 'Locks BCH between buyer/seller with arbiter',
    },
    {
      name: 'SplitPayment',
      artifact: 'split-payment',
      args: [DUMMY_PKH, DUMMY_PKH, 70n, 30n],
      description: 'Splits payment between two recipients (70/30)',
    },
    {
      name: 'SavingsVault',
      artifact: 'savings-vault',
      args: [DUMMY_PKH, BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60)],
      description: 'Time-locked savings vault',
    },
  ];

  const deployments: Array<{ name: string; address: string; tokenAddress: string }> = [];

  for (const def of contracts) {
    try {
      console.log(`${def.name}: ${def.description}`);
      const artifact = loadArtifact(def.artifact);
      const contract = new Contract(artifact, def.args, { provider });

      console.log(`  Address:       ${contract.address}`);
      console.log(`  Token Address: ${contract.tokenAddress}`);

      if (!DRY_RUN) {
        const balance = await getBalanceWithTimeout(contract);
        console.log(`  Balance:       ${balance !== null ? `${balance} sats` : 'unable to query'}`);
      }

      deployments.push({
        name: def.name,
        address: contract.address,
        tokenAddress: contract.tokenAddress,
      });
      console.log('');
    } catch (error) {
      console.error(`  ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  // Write preview info
  const deploymentsPath = path.join(ARTIFACTS_DIR, 'deployments.json');
  fs.writeFileSync(deploymentsPath, JSON.stringify({
    network: NETWORK,
    dryRun: DRY_RUN,
    previewOnly: true,
    note: 'These addresses use dummy keys. Real instances are created at runtime by the API.',
    generatedAt: new Date().toISOString(),
    contracts: deployments,
  }, null, 2));

  console.log(`Preview info written to: ${deploymentsPath}`);
  console.log('Done!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
