/**
 * BCH Pay — Contract Interaction Examples
 *
 * Demonstrates how to interact with each deployed CashScript contract.
 * This script shows usage patterns for all four contracts:
 *
 *   1. PaymentGateway — Forward a BCH payment to a merchant
 *   2. Escrow         — Release, refund, or resolve an escrowed payment
 *   3. SplitPayment   — Split a payment between two recipients
 *   4. SavingsVault   — Withdraw time-locked savings
 *
 * Prerequisites:
 *   1. Run `npm run compile` to generate artifacts.
 *   2. Run `npm run deploy` to deploy contracts (or use existing addresses).
 *   3. Fund the contract addresses with chipnet BCH.
 *
 * Usage:
 *   npx tsx src/interact.ts
 *   npm run interact
 *
 * NOTE: This script uses placeholder keys. In production, you would use
 * real key pairs from a wallet. The examples below demonstrate the
 * transaction-building API but will not broadcast without valid keys and funding.
 */

import {
  ElectrumNetworkProvider,
  Contract,
  SignatureTemplate,
  type NetworkProvider,
} from 'cashscript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARTIFACTS_DIR = path.resolve(__dirname, '..', 'artifacts');

// ─── Configuration ───────────────────────────────────────────────────────────

const NETWORK = (process.env.NETWORK as 'chipnet' | 'mainnet') || 'chipnet';

// In a real application, these would come from a wallet or key management system.
// For this example, we use placeholder values to demonstrate the API.
//
// To run these examples for real:
//   1. Generate key pairs using @cashscript/utils or libauth
//   2. Export the private keys and public key hashes
//   3. Fund the contract addresses on chipnet

// Placeholder 20-byte public key hashes (hex)
const MERCHANT_PKH  = '0000000000000000000000000000000000000001';
const BUYER_PKH     = '0000000000000000000000000000000000000002';
const SELLER_PKH    = '0000000000000000000000000000000000000003';
const ARBITER_PKH   = '0000000000000000000000000000000000000004';
const RECIPIENT1_PKH = '0000000000000000000000000000000000000005';
const RECIPIENT2_PKH = '0000000000000000000000000000000000000006';
const OWNER_PKH     = '0000000000000000000000000000000000000007';

// ─── Helper Functions ────────────────────────────────────────────────────────

function loadArtifact(name: string): object {
  const artifactPath = path.join(ARTIFACTS_DIR, `${name}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Artifact not found: ${artifactPath}\n` +
      'Run "npm run compile" first.'
    );
  }
  return JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
}

function separator(title: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

// ─── Example 1: Payment Gateway ──────────────────────────────────────────────

async function examplePaymentGateway(provider: NetworkProvider): Promise<void> {
  separator('Example 1: Payment Gateway');

  const artifact = loadArtifact('payment-gateway');
  const contract = new Contract(artifact, [MERCHANT_PKH], { provider });

  console.log(`Contract address: ${contract.address}`);
  console.log(`Token address:    ${contract.tokenAddress}`);

  // Check contract balance (UTXOs)
  const balance = await contract.getBalance();
  console.log(`Balance: ${balance} satoshis`);

  const utxos = await contract.getUtxos();
  console.log(`UTXOs: ${utxos.length}`);

  if (utxos.length === 0) {
    console.log('\nNo UTXOs found. Fund the contract address to interact.');
    console.log('Send chipnet BCH to:', contract.address);
    console.log('\nShowing how the transaction would be built:\n');
  }

  // Demonstrate building a payment transaction.
  //
  // In CashScript 0.10.x, you call contract functions like:
  //   contract.functions.<functionName>(...args)
  //     .to(address, amount)
  //     .withOpReturn([...chunks])
  //     .send()
  //
  // The pay() function requires: pubkey pk, sig s, int amount, bytes memo
  // The signature is handled by SignatureTemplate which auto-signs during send().

  console.log('Transaction build example (PaymentGateway.pay):');
  console.log('');
  console.log('  // With a real private key:');
  console.log('  // const merchantKeypair = ... // from wallet');
  console.log('  // const sigTemplate = new SignatureTemplate(merchantKeypair);');
  console.log('  //');
  console.log('  // const paymentAmount = 10000; // 10,000 satoshis');
  console.log('  // const memo = Buffer.from("INV-2024-001", "utf-8");');
  console.log('  //');
  console.log('  // const tx = await contract.functions');
  console.log('  //   .pay(merchantPubkey, sigTemplate, paymentAmount, memo)');
  console.log('  //   .to(merchantAddress, paymentAmount)');
  console.log('  //   .withOpReturn(["INV-2024-001"])');
  console.log('  //   .send();');
  console.log('  //');
  console.log('  // console.log("Transaction ID:", tx.txid);');

  // If there are UTXOs and we had real keys, we would do:
  //
  // const privateKey = Uint8Array.from(Buffer.from('<hex-private-key>', 'hex'));
  // const sigTemplate = new SignatureTemplate(privateKey);
  //
  // const tx = await contract.functions
  //   .pay(
  //     merchantPublicKey,           // pubkey
  //     sigTemplate,                 // sig (auto-signed)
  //     BigInt(10000),               // amount in satoshis
  //     Buffer.from('INV-001')       // memo bytes
  //   )
  //   .to(merchantCashAddr, 10000)
  //   .withOpReturn(['INV-001'])
  //   .send();
  //
  // console.log('Payment forwarded! TX:', tx.txid);
}

// ─── Example 2: Escrow ───────────────────────────────────────────────────────

async function exampleEscrow(provider: NetworkProvider): Promise<void> {
  separator('Example 2: Escrow');

  const timeout = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 1 week

  const artifact = loadArtifact('escrow');
  const contract = new Contract(
    artifact,
    [BUYER_PKH, SELLER_PKH, ARBITER_PKH, BigInt(timeout)],
    { provider },
  );

  console.log(`Contract address: ${contract.address}`);
  console.log(`Token address:    ${contract.tokenAddress}`);

  const balance = await contract.getBalance();
  console.log(`Balance: ${balance} satoshis`);

  const utxos = await contract.getUtxos();
  console.log(`UTXOs: ${utxos.length}`);

  if (utxos.length === 0) {
    console.log('\nNo UTXOs found. Fund the contract address to interact.');
    console.log('Send chipnet BCH to:', contract.address);
  }

  // ─── Path 1: Release (buyer + seller agree) ──────────────────────────────
  console.log('\n--- Path 1: Release (buyer + seller agree) ---');
  console.log('');
  console.log('  // Both buyer and seller sign to release funds to seller:');
  console.log('  //');
  console.log('  // const buyerSig = new SignatureTemplate(buyerPrivateKey);');
  console.log('  // const sellerSig = new SignatureTemplate(sellerPrivateKey);');
  console.log('  //');
  console.log('  // const tx = await contract.functions');
  console.log('  //   .release(buyerPubkey, buyerSig, sellerPubkey, sellerSig)');
  console.log('  //   .to(sellerAddress, contractBalance - minerFee)');
  console.log('  //   .send();');
  console.log('  //');
  console.log('  // console.log("Released to seller! TX:", tx.txid);');

  // ─── Path 2: Refund (timeout expired) ─────────────────────────────────────
  console.log('\n--- Path 2: Refund (timeout expired) ---');
  console.log('');
  console.log('  // After timeout, buyer can reclaim funds:');
  console.log('  //');
  console.log('  // const buyerSig = new SignatureTemplate(buyerPrivateKey);');
  console.log('  //');
  console.log('  // const tx = await contract.functions');
  console.log('  //   .refund(buyerPubkey, buyerSig)');
  console.log('  //   .to(buyerAddress, contractBalance - minerFee)');
  console.log('  //   .withTime(timeout)  // sets nLockTime');
  console.log('  //   .send();');
  console.log('  //');
  console.log('  // console.log("Refunded to buyer! TX:", tx.txid);');

  // ─── Path 3: Resolve (arbiter decides) ─────────────────────────────────────
  console.log('\n--- Path 3: Arbiter resolves dispute ---');
  console.log('');
  console.log('  // Arbiter sends funds to the winning party:');
  console.log('  //');
  console.log('  // const arbiterSig = new SignatureTemplate(arbiterPrivateKey);');
  console.log('  // const winnerPkh = sellerPkh; // or buyerPkh');
  console.log('  //');
  console.log('  // const tx = await contract.functions');
  console.log('  //   .resolve(arbiterPubkey, arbiterSig, winnerPkh)');
  console.log('  //   .to(winnerAddress, contractBalance - minerFee)');
  console.log('  //   .send();');
  console.log('  //');
  console.log('  // console.log("Dispute resolved! TX:", tx.txid);');
}

// ─── Example 3: Split Payment ────────────────────────────────────────────────

async function exampleSplitPayment(provider: NetworkProvider): Promise<void> {
  separator('Example 3: Split Payment');

  const split1Percent = 70;
  const split2Percent = 30;

  const artifact = loadArtifact('split-payment');
  const contract = new Contract(
    artifact,
    [RECIPIENT1_PKH, RECIPIENT2_PKH, BigInt(split1Percent), BigInt(split2Percent)],
    { provider },
  );

  console.log(`Contract address: ${contract.address}`);
  console.log(`Token address:    ${contract.tokenAddress}`);
  console.log(`Split: ${split1Percent}% / ${split2Percent}%`);

  const balance = await contract.getBalance();
  console.log(`Balance: ${balance} satoshis`);

  const utxos = await contract.getUtxos();
  console.log(`UTXOs: ${utxos.length}`);

  if (utxos.length === 0) {
    console.log('\nNo UTXOs found. Fund the contract address to interact.');
    console.log('Send chipnet BCH to:', contract.address);
  }

  // Demonstrate the split calculation
  if (balance > 0n) {
    const minerFee = 1000n;
    const distributable = balance - minerFee;
    const amount1 = distributable * BigInt(split1Percent) / 100n;
    const amount2 = distributable - amount1;

    console.log('\nCalculated split:');
    console.log(`  Total balance:    ${balance} satoshis`);
    console.log(`  Miner fee:        ${minerFee} satoshis`);
    console.log(`  Distributable:    ${distributable} satoshis`);
    console.log(`  Recipient 1 (${split1Percent}%): ${amount1} satoshis`);
    console.log(`  Recipient 2 (${split2Percent}%): ${amount2} satoshis`);
  }

  console.log('\nTransaction build example (SplitPayment.execute):');
  console.log('');
  console.log('  // The caller provides a signature to authorize the split:');
  console.log('  //');
  console.log('  // const callerSig = new SignatureTemplate(callerPrivateKey);');
  console.log('  //');
  console.log('  // const tx = await contract.functions');
  console.log('  //   .execute(callerPubkey, callerSig)');
  console.log('  //   .to(recipient1Address, amount1)');
  console.log('  //   .to(recipient2Address, amount2)');
  console.log('  //   .send();');
  console.log('  //');
  console.log('  // console.log("Split payment executed! TX:", tx.txid);');
}

// ─── Example 4: Savings Vault ────────────────────────────────────────────────

async function exampleSavingsVault(provider: NetworkProvider): Promise<void> {
  separator('Example 4: Savings Vault (Time-Locked)');

  // Lock for 30 days from now
  const locktime = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const lockDate = new Date(locktime * 1000);

  const artifact = loadArtifact('savings-vault');
  const contract = new Contract(
    artifact,
    [OWNER_PKH, BigInt(locktime)],
    { provider },
  );

  console.log(`Contract address: ${contract.address}`);
  console.log(`Token address:    ${contract.tokenAddress}`);
  console.log(`Lock expires:     ${lockDate.toISOString()}`);

  const balance = await contract.getBalance();
  console.log(`Balance: ${balance} satoshis`);

  const utxos = await contract.getUtxos();
  console.log(`UTXOs: ${utxos.length}`);

  if (utxos.length === 0) {
    console.log('\nNo UTXOs found. Fund the contract address to lock BCH.');
    console.log('Send chipnet BCH to:', contract.address);
  }

  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = locktime - now;

  if (timeRemaining > 0) {
    const days = Math.floor(timeRemaining / (24 * 60 * 60));
    const hours = Math.floor((timeRemaining % (24 * 60 * 60)) / (60 * 60));
    console.log(`\nTime remaining: ${days} days, ${hours} hours`);
    console.log('Withdrawal is NOT yet available.');
  } else {
    console.log('\nLock period has expired! Withdrawal is available.');
  }

  console.log('\nTransaction build example (SavingsVault.withdraw):');
  console.log('');
  console.log('  // After the locktime expires, the owner can withdraw:');
  console.log('  //');
  console.log('  // const ownerSig = new SignatureTemplate(ownerPrivateKey);');
  console.log('  //');
  console.log('  // const tx = await contract.functions');
  console.log('  //   .withdraw(ownerPubkey, ownerSig)');
  console.log('  //   .to(ownerAddress, contractBalance - minerFee)');
  console.log('  //   .withTime(locktime)  // sets nLockTime');
  console.log('  //   .send();');
  console.log('  //');
  console.log('  // console.log("Savings withdrawn! TX:", tx.txid);');

  // ─── Deposit example ──────────────────────────────────────────────────────
  console.log('\n--- Depositing into the vault ---');
  console.log('');
  console.log('  // To deposit, simply send BCH to the contract address:');
  console.log(`  // Send BCH to: ${contract.address}`);
  console.log('  //');
  console.log('  // Using any BCH wallet or mainnet-js:');
  console.log('  // const wallet = await Wallet.fromSeed("...");');
  console.log(`  // await wallet.send([{ cashaddr: "${contract.address}", value: 100000 }]);`);
}

// ─── Utility: Show Contract Function Signatures ──────────────────────────────

function showContractABI(artifactName: string): void {
  const artifact = loadArtifact(artifactName) as {
    contractName: string;
    abi: Array<{
      name: string;
      inputs: Array<{ name: string; type: string }>;
    }>;
  };

  console.log(`\n  ${artifact.contractName} ABI:`);
  for (const fn of artifact.abi) {
    const params = fn.inputs
      .map((input) => `${input.type} ${input.name}`)
      .join(', ');
    console.log(`    function ${fn.name}(${params})`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('========================================');
  console.log('  BCH Pay — Contract Interaction Examples');
  console.log(`  Network: ${NETWORK}`);
  console.log('========================================');

  const provider = new ElectrumNetworkProvider(NETWORK);

  // Show all contract ABIs
  separator('Contract ABIs');
  const contracts = ['payment-gateway', 'escrow', 'split-payment', 'savings-vault'];
  for (const name of contracts) {
    try {
      showContractABI(name);
    } catch (error) {
      console.log(`  ${name}: Not compiled yet`);
    }
  }

  // Run all examples
  try {
    await examplePaymentGateway(provider);
  } catch (error) {
    console.error('PaymentGateway example error:', error instanceof Error ? error.message : String(error));
  }

  try {
    await exampleEscrow(provider);
  } catch (error) {
    console.error('Escrow example error:', error instanceof Error ? error.message : String(error));
  }

  try {
    await exampleSplitPayment(provider);
  } catch (error) {
    console.error('SplitPayment example error:', error instanceof Error ? error.message : String(error));
  }

  try {
    await exampleSavingsVault(provider);
  } catch (error) {
    console.error('SavingsVault example error:', error instanceof Error ? error.message : String(error));
  }

  separator('Done');
  console.log('\nAll examples completed.');
  console.log('To run real transactions, replace placeholder keys with actual wallet keys');
  console.log('and fund the contract addresses on chipnet.');
  console.log('\nChipnet faucet: https://tbch.googol.cash/');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
