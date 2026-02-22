/**
 * BCH Pay — Contract Deployment Script
 *
 * Deploys all compiled CashScript contracts to the BCH chipnet (testnet).
 * For each contract, it instantiates with example constructor parameters
 * and logs the resulting contract address.
 *
 * Prerequisites:
 *   1. Run `npm run compile` first to generate artifact JSON files.
 *   2. Ensure you have chipnet BCH for testing.
 *
 * Usage:
 *   npx tsx src/deploy.ts             # Deploy to chipnet (queries balance)
 *   npx tsx src/deploy.ts --dry-run   # Generate addresses only (no network)
 *   npm run deploy
 *   npm run deploy:dry
 *
 * Environment variables:
 *   MERCHANT_PKH     — Merchant's public key hash (hex, 20 bytes) for PaymentGateway
 *   BUYER_PKH        — Buyer's public key hash (hex, 20 bytes) for Escrow
 *   SELLER_PKH       — Seller's public key hash (hex, 20 bytes) for Escrow
 *   ARBITER_PKH      — Arbiter's public key hash (hex, 20 bytes) for Escrow
 *   RECIPIENT1_PKH   — Recipient 1's public key hash (hex) for SplitPayment
 *   RECIPIENT2_PKH   — Recipient 2's public key hash (hex) for SplitPayment
 *   OWNER_PKH        — Owner's public key hash (hex) for SavingsVault
 *   NETWORK           — "chipnet" (default) or "mainnet"
 */

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

// ─── Configuration ───────────────────────────────────────────────────────────

// Network: "chipnet" for testnet, "mainnet" for production
const NETWORK = (process.env.NETWORK as 'chipnet' | 'mainnet') || 'chipnet';
const DRY_RUN = process.argv.includes('--dry-run');

// Example public key hashes (20 bytes hex = 40 hex chars).
// In production, these come from actual wallet key pairs.
// These defaults are placeholders — replace with real values for deployment.
const DEFAULT_PKH = '0000000000000000000000000000000000000000';

const MERCHANT_PKH = process.env.MERCHANT_PKH || DEFAULT_PKH;
const BUYER_PKH    = process.env.BUYER_PKH    || DEFAULT_PKH;
const SELLER_PKH   = process.env.SELLER_PKH   || DEFAULT_PKH;
const ARBITER_PKH  = process.env.ARBITER_PKH  || DEFAULT_PKH;
const RECIPIENT1_PKH = process.env.RECIPIENT1_PKH || DEFAULT_PKH;
const RECIPIENT2_PKH = process.env.RECIPIENT2_PKH || DEFAULT_PKH;
const OWNER_PKH    = process.env.OWNER_PKH    || DEFAULT_PKH;

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Load a compiled artifact JSON file.
 */
function loadArtifact(name: string): object {
  const artifactPath = path.join(ARTIFACTS_DIR, `${name}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Artifact not found: ${artifactPath}\n` +
      `Run "npm run compile" first to generate artifacts.`
    );
  }
  const raw = fs.readFileSync(artifactPath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Deploy a single contract with the given constructor arguments.
 * Returns the Contract instance.
 */
function deployContract(
  artifactName: string,
  constructorArgs: Array<string | number | bigint | Uint8Array>,
  provider: NetworkProvider,
): Contract {
  const artifact = loadArtifact(artifactName);
  const contract = new Contract(artifact, constructorArgs, { provider });
  return contract;
}

/**
 * Query balance with a timeout to handle network issues.
 */
async function getBalanceWithTimeout(contract: Contract, timeoutMs = 10_000): Promise<bigint | null> {
  try {
    const result = await Promise.race([
      contract.getBalance(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Balance query timed out')), timeoutMs)
      ),
    ]);
    return result;
  } catch {
    return null;
  }
}

// ─── Main Deployment ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('========================================');
  console.log('  BCH Pay — Contract Deployment');
  console.log(`  Network: ${NETWORK}${DRY_RUN ? ' (DRY RUN — no network queries)' : ''}`);
  console.log('========================================\n');

  // Use MockNetworkProvider for dry runs, ElectrumNetworkProvider for real deployment
  const provider = DRY_RUN
    ? new MockNetworkProvider()
    : new ElectrumNetworkProvider(NETWORK);

  const deployments: Array<{ name: string; address: string; tokenAddress: string }> = [];

  // ─── 1. Payment Gateway ──────────────────────────────────────────────────
  try {
    console.log('Deploying: PaymentGateway');
    console.log(`  merchantPkh: ${MERCHANT_PKH}`);

    const paymentGateway = deployContract(
      'payment-gateway',
      [MERCHANT_PKH],
      provider,
    );

    const address = paymentGateway.address;
    const tokenAddress = paymentGateway.tokenAddress;

    console.log(`  Contract address: ${address}`);
    console.log(`  Token address:    ${tokenAddress}`);

    if (!DRY_RUN) {
      const balance = await getBalanceWithTimeout(paymentGateway);
      console.log(`  Balance: ${balance !== null ? `${balance} satoshis` : 'unable to query (network unavailable)'}`);
    }

    deployments.push({ name: 'PaymentGateway', address, tokenAddress });
    console.log('  SUCCESS\n');
  } catch (error) {
    console.error(`  ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  // ─── 2. Escrow ───────────────────────────────────────────────────────────
  try {
    console.log('Deploying: Escrow');
    console.log(`  buyerPkh:   ${BUYER_PKH}`);
    console.log(`  sellerPkh:  ${SELLER_PKH}`);
    console.log(`  arbiterPkh: ${ARBITER_PKH}`);

    const timeout = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 1 week from now
    console.log(`  timeout:    ${timeout} (UNIX timestamp, ~1 week from now)`);

    const escrow = deployContract(
      'escrow',
      [BUYER_PKH, SELLER_PKH, ARBITER_PKH, BigInt(timeout)],
      provider,
    );

    const address = escrow.address;
    const tokenAddress = escrow.tokenAddress;

    console.log(`  Contract address: ${address}`);
    console.log(`  Token address:    ${tokenAddress}`);

    if (!DRY_RUN) {
      const balance = await getBalanceWithTimeout(escrow);
      console.log(`  Balance: ${balance !== null ? `${balance} satoshis` : 'unable to query (network unavailable)'}`);
    }

    deployments.push({ name: 'Escrow', address, tokenAddress });
    console.log('  SUCCESS\n');
  } catch (error) {
    console.error(`  ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  // ─── 3. Split Payment ────────────────────────────────────────────────────
  try {
    console.log('Deploying: SplitPayment');
    console.log(`  recipient1Pkh:  ${RECIPIENT1_PKH}`);
    console.log(`  recipient2Pkh:  ${RECIPIENT2_PKH}`);

    const split1Percent = 70;
    const split2Percent = 30;
    console.log(`  split1Percent:  ${split1Percent}%`);
    console.log(`  split2Percent:  ${split2Percent}%`);

    const splitPayment = deployContract(
      'split-payment',
      [RECIPIENT1_PKH, RECIPIENT2_PKH, BigInt(split1Percent), BigInt(split2Percent)],
      provider,
    );

    const address = splitPayment.address;
    const tokenAddress = splitPayment.tokenAddress;

    console.log(`  Contract address: ${address}`);
    console.log(`  Token address:    ${tokenAddress}`);

    if (!DRY_RUN) {
      const balance = await getBalanceWithTimeout(splitPayment);
      console.log(`  Balance: ${balance !== null ? `${balance} satoshis` : 'unable to query (network unavailable)'}`);
    }

    deployments.push({ name: 'SplitPayment', address, tokenAddress });
    console.log('  SUCCESS\n');
  } catch (error) {
    console.error(`  ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  // ─── 4. Savings Vault ────────────────────────────────────────────────────
  try {
    console.log('Deploying: SavingsVault');
    console.log(`  ownerPkh: ${OWNER_PKH}`);

    const locktime = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    console.log(`  locktime:  ${locktime} (UNIX timestamp, ~30 days from now)`);

    const savingsVault = deployContract(
      'savings-vault',
      [OWNER_PKH, BigInt(locktime)],
      provider,
    );

    const address = savingsVault.address;
    const tokenAddress = savingsVault.tokenAddress;

    console.log(`  Contract address: ${address}`);
    console.log(`  Token address:    ${tokenAddress}`);

    if (!DRY_RUN) {
      const balance = await getBalanceWithTimeout(savingsVault);
      console.log(`  Balance: ${balance !== null ? `${balance} satoshis` : 'unable to query (network unavailable)'}`);
    }

    deployments.push({ name: 'SavingsVault', address, tokenAddress });
    console.log('  SUCCESS\n');
  } catch (error) {
    console.error(`  ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log('========================================');
  console.log('  Deployment Summary');
  console.log('========================================');

  if (deployments.length === 0) {
    console.log('No contracts deployed successfully.');
    process.exit(1);
  }

  for (const d of deployments) {
    console.log(`\n  ${d.name}:`);
    console.log(`    Address:       ${d.address}`);
    console.log(`    Token Address: ${d.tokenAddress}`);
  }

  // Write deployment info to a JSON file for other scripts to consume
  const deploymentsPath = path.join(ARTIFACTS_DIR, 'deployments.json');
  const deploymentData = {
    network: NETWORK,
    dryRun: DRY_RUN,
    deployedAt: new Date().toISOString(),
    contracts: deployments,
  };
  fs.writeFileSync(deploymentsPath, JSON.stringify(deploymentData, null, 2));
  console.log(`\nDeployment info written to: ${deploymentsPath}`);

  console.log('\nDone!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
