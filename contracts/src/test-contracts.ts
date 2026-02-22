/**
 * BCH Pay — Contract Unit Tests
 *
 * Tests all four CashScript contracts using MockNetworkProvider.
 * Each contract's spending paths are verified, including edge cases
 * like insufficient funds, expired timelocks, and wrong keys.
 *
 * Usage:
 *   npx tsx src/test-contracts.ts
 *   npm test
 */

import {
  Contract,
  MockNetworkProvider,
  SignatureTemplate,
  randomUtxo,
} from 'cashscript';
import { hash160 } from '@cashscript/utils';
import { compileFile } from 'cashc';
import { encodeCashAddress } from '@bitauth/libauth';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTRACTS_DIR = path.resolve(__dirname, '..', 'contracts');

// ─── Test Infrastructure ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

function test(name: string, fn: () => Promise<void>): Promise<void> {
  return fn()
    .then(() => {
      console.log(`  ✓ ${name}`);
      passed++;
    })
    .catch((err: any) => {
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${err.message || err}`);
      errors.push(`${name}: ${err.message || err}`);
      failed++;
    });
}

function expectThrow(name: string, fn: () => Promise<void>): Promise<void> {
  return fn()
    .then(() => {
      console.log(`  ✗ ${name} (expected to throw but didn't)`);
      errors.push(`${name}: expected to throw`);
      failed++;
    })
    .catch(() => {
      console.log(`  ✓ ${name} (correctly rejected)`);
      passed++;
    });
}

// ─── Address Helper ─────────────────────────────────────────────────────────

function pkhToAddress(pkh: Uint8Array): string {
  const result = encodeCashAddress({
    payload: pkh,
    type: 'p2pkh',
    prefix: 'bchtest',
  });
  if (typeof result === 'string') throw new Error(`Address encoding failed: ${result}`);
  return result.address;
}

// ─── Test Key Setup ─────────────────────────────────────────────────────────

// Generate deterministic test keys (32-byte private keys)
function makeKey(seed: number): Uint8Array {
  const key = new Uint8Array(32);
  key[0] = seed;
  key[31] = seed;
  for (let i = 1; i < 31; i++) {
    key[i] = (seed * 17 + i * 13) & 0xff;
  }
  return key;
}

const merchantKey = makeKey(1);
const buyerKey = makeKey(2);
const sellerKey = makeKey(3);
const arbiterKey = makeKey(4);
const recipient1Key = makeKey(5);
const recipient2Key = makeKey(6);
const ownerKey = makeKey(7);
const wrongKey = makeKey(99);

const merchantSigner = new SignatureTemplate(merchantKey);
const buyerSigner = new SignatureTemplate(buyerKey);
const sellerSigner = new SignatureTemplate(sellerKey);
const arbiterSigner = new SignatureTemplate(arbiterKey);
const recipient1Signer = new SignatureTemplate(recipient1Key);
const recipient2Signer = new SignatureTemplate(recipient2Key);
const ownerSigner = new SignatureTemplate(ownerKey);
const wrongSigner = new SignatureTemplate(wrongKey);

const merchantPk = merchantSigner.getPublicKey();
const buyerPk = buyerSigner.getPublicKey();
const sellerPk = sellerSigner.getPublicKey();
const arbiterPk = arbiterSigner.getPublicKey();
const recipient1Pk = recipient1Signer.getPublicKey();
const recipient2Pk = recipient2Signer.getPublicKey();
const ownerPk = ownerSigner.getPublicKey();
const wrongPk = wrongSigner.getPublicKey();

const merchantPkh = hash160(merchantPk);
const buyerPkh = hash160(buyerPk);
const sellerPkh = hash160(sellerPk);
const arbiterPkh = hash160(arbiterPk);
const recipient1Pkh = hash160(recipient1Pk);
const recipient2Pkh = hash160(recipient2Pk);
const ownerPkh = hash160(ownerPk);

// Precompute P2PKH addresses
const merchantAddr = pkhToAddress(merchantPkh);
const buyerAddr = pkhToAddress(buyerPkh);
const sellerAddr = pkhToAddress(sellerPkh);
const recipient1Addr = pkhToAddress(recipient1Pkh);
const recipient2Addr = pkhToAddress(recipient2Pkh);
const ownerAddr = pkhToAddress(ownerPkh);

// ─── Helper: create funded contract ─────────────────────────────────────────

function fundContract(contract: Contract, provider: MockNetworkProvider, satoshis: bigint = 100_000n) {
  const utxo = randomUtxo({ satoshis });
  provider.addUtxo(contract.address, utxo);
  return utxo;
}

// ─── Test Suite: PaymentGateway ─────────────────────────────────────────────

async function testPaymentGateway() {
  console.log('\n── PaymentGateway ──────────────────────────────');

  const artifact = compileFile(path.join(CONTRACTS_DIR, 'payment-gateway.cash'));

  // Test: successful payment forwarding with memo
  await test('pay() forwards funds to merchant with memo', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(artifact, [merchantPkh], { provider });
    const utxo = fundContract(contract, provider, 50_000n);

    const memo = Buffer.from('INV-001');
    const tx = await contract.functions
      .pay(merchantPk, merchantSigner, 10_000n, memo)
      .from(utxo)
      .to(merchantAddr, 10_000n)
      .withOpReturn(['INV-001'])
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();

    if (!tx.txid) throw new Error('No txid');
  });

  // Test: payment with empty memo (no OP_RETURN)
  await test('pay() works with empty memo', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(artifact, [merchantPkh], { provider });
    const utxo = fundContract(contract, provider, 50_000n);

    const tx = await contract.functions
      .pay(merchantPk, merchantSigner, 10_000n, Buffer.alloc(0))
      .from(utxo)
      .to(merchantAddr, 49_000n)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();

    if (!tx.txid) throw new Error('No txid');
  });

  // Test: wrong key rejected
  await expectThrow('pay() rejects wrong key', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(artifact, [merchantPkh], { provider });
    const utxo = fundContract(contract, provider, 50_000n);

    await contract.functions
      .pay(wrongPk, wrongSigner, 10_000n, Buffer.from('test'))
      .from(utxo)
      .to(merchantAddr, 10_000n)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();
  });

  // Test: amount below dust limit rejected
  await expectThrow('pay() rejects amount below dust limit (546 sats)', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(artifact, [merchantPkh], { provider });
    const utxo = fundContract(contract, provider, 50_000n);

    await contract.functions
      .pay(merchantPk, merchantSigner, 100n, Buffer.from('test'))
      .from(utxo)
      .to(merchantAddr, 100n)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();
  });
}

// ─── Test Suite: Escrow ─────────────────────────────────────────────────────

async function testEscrow() {
  console.log('\n── Escrow ─────────────────────────────────────');

  const artifact = compileFile(path.join(CONTRACTS_DIR, 'escrow.cash'));
  const timeout = 1_000_000_000n; // Far future timestamp

  // Test: release with both buyer + seller signatures
  await test('release() succeeds with buyer + seller signatures', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(
      artifact,
      [buyerPkh, sellerPkh, arbiterPkh, timeout],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    const tx = await contract.functions
      .release(buyerPk, buyerSigner, sellerPk, sellerSigner)
      .from(utxo)
      .to(sellerAddr, 99_000n)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();

    if (!tx.txid) throw new Error('No txid');
  });

  // Test: release with wrong buyer key
  await expectThrow('release() rejects wrong buyer key', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(
      artifact,
      [buyerPkh, sellerPkh, arbiterPkh, timeout],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    await contract.functions
      .release(wrongPk, wrongSigner, sellerPk, sellerSigner)
      .from(utxo)
      .to(sellerAddr, 99_000n)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();
  });

  // Test: release with wrong seller key
  await expectThrow('release() rejects wrong seller key', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(
      artifact,
      [buyerPkh, sellerPkh, arbiterPkh, timeout],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    await contract.functions
      .release(buyerPk, buyerSigner, wrongPk, wrongSigner)
      .from(utxo)
      .to(sellerAddr, 99_000n)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();
  });

  // Test: refund after timeout
  await test('refund() succeeds after timeout expires', async () => {
    const provider = new MockNetworkProvider();
    const pastTimeout = 500_000_000n;
    const contract = new Contract(
      artifact,
      [buyerPkh, sellerPkh, arbiterPkh, pastTimeout],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    const tx = await contract.functions
      .refund(buyerPk, buyerSigner)
      .from(utxo)
      .to(buyerAddr, 99_000n)
      .withTime(Number(pastTimeout))
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();

    if (!tx.txid) throw new Error('No txid');
  });

  // Test: refund rejected before timeout
  await expectThrow('refund() rejects before timeout', async () => {
    const provider = new MockNetworkProvider();
    const futureTimeout = 2_000_000_000n;
    const contract = new Contract(
      artifact,
      [buyerPkh, sellerPkh, arbiterPkh, futureTimeout],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    await contract.functions
      .refund(buyerPk, buyerSigner)
      .from(utxo)
      .to(buyerAddr, 99_000n)
      .withTime(1_000_000_000)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();
  });

  // Test: refund rejected with wrong key
  await expectThrow('refund() rejects non-buyer key', async () => {
    const provider = new MockNetworkProvider();
    const pastTimeout = 500_000_000n;
    const contract = new Contract(
      artifact,
      [buyerPkh, sellerPkh, arbiterPkh, pastTimeout],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    await contract.functions
      .refund(sellerPk, sellerSigner)
      .from(utxo)
      .to(buyerAddr, 99_000n)
      .withTime(Number(pastTimeout))
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();
  });

  // Test: arbiter resolves to seller
  await test('resolve() arbiter sends to seller', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(
      artifact,
      [buyerPkh, sellerPkh, arbiterPkh, timeout],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    const tx = await contract.functions
      .resolve(arbiterPk, arbiterSigner, sellerPkh)
      .from(utxo)
      .to(sellerAddr, 99_000n)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();

    if (!tx.txid) throw new Error('No txid');
  });

  // Test: arbiter resolves to buyer
  await test('resolve() arbiter sends to buyer', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(
      artifact,
      [buyerPkh, sellerPkh, arbiterPkh, timeout],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    const tx = await contract.functions
      .resolve(arbiterPk, arbiterSigner, buyerPkh)
      .from(utxo)
      .to(buyerAddr, 99_000n)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();

    if (!tx.txid) throw new Error('No txid');
  });

  // Test: arbiter cannot send to third party
  await expectThrow('resolve() rejects sending to third party', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(
      artifact,
      [buyerPkh, sellerPkh, arbiterPkh, timeout],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    const thirdPartyPkh = hash160(wrongPk);
    await contract.functions
      .resolve(arbiterPk, arbiterSigner, thirdPartyPkh)
      .from(utxo)
      .to(pkhToAddress(thirdPartyPkh), 99_000n)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();
  });

  // Test: non-arbiter cannot resolve
  await expectThrow('resolve() rejects non-arbiter key', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(
      artifact,
      [buyerPkh, sellerPkh, arbiterPkh, timeout],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    await contract.functions
      .resolve(wrongPk, wrongSigner, sellerPkh)
      .from(utxo)
      .to(sellerAddr, 99_000n)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();
  });
}

// ─── Test Suite: SplitPayment ───────────────────────────────────────────────

async function testSplitPayment() {
  console.log('\n── SplitPayment ───────────────────────────────');

  const artifact = compileFile(path.join(CONTRACTS_DIR, 'split-payment.cash'));

  // Test: 70/30 split
  // totalValue=100000, minerFee=1000, distributable=99000
  // amount1 = 99000 * 70 / 100 = 69300
  // amount2 = 99000 - 69300 = 29700
  await test('execute() splits 70/30 correctly', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(
      artifact,
      [recipient1Pkh, recipient2Pkh, 70n, 30n],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    const tx = await contract.functions
      .execute(recipient1Pk, recipient1Signer)
      .from(utxo)
      .to(recipient1Addr, 69_300n)
      .to(recipient2Addr, 29_700n)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();

    if (!tx.txid) throw new Error('No txid');
  });

  // Test: 50/50 split
  // amount1 = 99000 * 50 / 100 = 49500
  // amount2 = 99000 - 49500 = 49500
  await test('execute() splits 50/50 correctly', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(
      artifact,
      [recipient1Pkh, recipient2Pkh, 50n, 50n],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    const tx = await contract.functions
      .execute(recipient1Pk, recipient1Signer)
      .from(utxo)
      .to(recipient1Addr, 49_500n)
      .to(recipient2Addr, 49_500n)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();

    if (!tx.txid) throw new Error('No txid');
  });

  // Test: invalid split percentages (don't add to 100)
  await expectThrow('execute() rejects percentages not summing to 100', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(
      artifact,
      [recipient1Pkh, recipient2Pkh, 60n, 30n], // 90, not 100
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    await contract.functions
      .execute(recipient1Pk, recipient1Signer)
      .from(utxo)
      .to(recipient1Addr, 59_400n)
      .to(recipient2Addr, 29_700n)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();
  });

  // Test: anyone can call execute (not restricted to recipients)
  await test('execute() can be called by any signer', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(
      artifact,
      [recipient1Pkh, recipient2Pkh, 70n, 30n],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    const tx = await contract.functions
      .execute(wrongPk, wrongSigner) // Any key works, just needs valid sig
      .from(utxo)
      .to(recipient1Addr, 69_300n)
      .to(recipient2Addr, 29_700n)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();

    if (!tx.txid) throw new Error('No txid');
  });
}

// ─── Test Suite: SavingsVault ───────────────────────────────────────────────

async function testSavingsVault() {
  console.log('\n── SavingsVault ───────────────────────────────');

  const artifact = compileFile(path.join(CONTRACTS_DIR, 'savings-vault.cash'));

  // Test: withdraw after locktime
  await test('withdraw() succeeds after locktime expires', async () => {
    const provider = new MockNetworkProvider();
    const locktime = 500_000_000n;
    const contract = new Contract(
      artifact,
      [ownerPkh, locktime],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    const tx = await contract.functions
      .withdraw(ownerPk, ownerSigner)
      .from(utxo)
      .to(ownerAddr, 99_000n)
      .withTime(Number(locktime))
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();

    if (!tx.txid) throw new Error('No txid');
  });

  // Test: withdraw rejected before locktime
  await expectThrow('withdraw() rejects before locktime', async () => {
    const provider = new MockNetworkProvider();
    const locktime = 2_000_000_000n;
    const contract = new Contract(
      artifact,
      [ownerPkh, locktime],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    await contract.functions
      .withdraw(ownerPk, ownerSigner)
      .from(utxo)
      .to(ownerAddr, 99_000n)
      .withTime(1_000_000_000)
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();
  });

  // Test: wrong key rejected
  await expectThrow('withdraw() rejects non-owner key', async () => {
    const provider = new MockNetworkProvider();
    const locktime = 500_000_000n;
    const contract = new Contract(
      artifact,
      [ownerPkh, locktime],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    await contract.functions
      .withdraw(wrongPk, wrongSigner)
      .from(utxo)
      .to(ownerAddr, 99_000n)
      .withTime(Number(locktime))
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();
  });

  // Test: block-height-based locktime (< 500,000,000)
  await test('withdraw() works with block-height locktime', async () => {
    const provider = new MockNetworkProvider();
    const blockHeight = 100_000n;
    const contract = new Contract(
      artifact,
      [ownerPkh, blockHeight],
      { provider }
    );
    const utxo = fundContract(contract, provider, 100_000n);

    const tx = await contract.functions
      .withdraw(ownerPk, ownerSigner)
      .from(utxo)
      .to(ownerAddr, 99_000n)
      .withTime(Number(blockHeight))
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();

    if (!tx.txid) throw new Error('No txid');
  });
}

// ─── Test Suite: Cross-contract edge cases ──────────────────────────────────

async function testEdgeCases() {
  console.log('\n── Edge Cases ─────────────────────────────────');

  // Test: contract with no UTXOs (insufficient funds)
  await expectThrow('transaction fails with no UTXOs (insufficient funds)', async () => {
    const artifact = compileFile(path.join(CONTRACTS_DIR, 'savings-vault.cash'));
    const provider = new MockNetworkProvider();
    const locktime = 500_000_000n;
    const contract = new Contract(
      artifact,
      [ownerPkh, locktime],
      { provider }
    );
    // Don't fund the contract — should fail

    await contract.functions
      .withdraw(ownerPk, ownerSigner)
      .to(ownerAddr, 99_000n)
      .withTime(Number(locktime))
      .withHardcodedFee(1_000n)
      .withoutChange()
      .send();
  });

  // Test: contract compilation produces valid addresses
  await test('all contracts produce valid addresses', async () => {
    const provider = new MockNetworkProvider();

    const pgArtifact = compileFile(path.join(CONTRACTS_DIR, 'payment-gateway.cash'));
    const pgContract = new Contract(pgArtifact, [merchantPkh], { provider });
    if (!pgContract.address.startsWith('bchtest:')) throw new Error('Invalid PaymentGateway address');

    const escrowArtifact = compileFile(path.join(CONTRACTS_DIR, 'escrow.cash'));
    const escrowContract = new Contract(escrowArtifact, [buyerPkh, sellerPkh, arbiterPkh, 1_000_000_000n], { provider });
    if (!escrowContract.address.startsWith('bchtest:')) throw new Error('Invalid Escrow address');

    const splitArtifact = compileFile(path.join(CONTRACTS_DIR, 'split-payment.cash'));
    const splitContract = new Contract(splitArtifact, [recipient1Pkh, recipient2Pkh, 50n, 50n], { provider });
    if (!splitContract.address.startsWith('bchtest:')) throw new Error('Invalid SplitPayment address');

    const vaultArtifact = compileFile(path.join(CONTRACTS_DIR, 'savings-vault.cash'));
    const vaultContract = new Contract(vaultArtifact, [ownerPkh, 500_000_000n], { provider });
    if (!vaultContract.address.startsWith('bchtest:')) throw new Error('Invalid SavingsVault address');
  });

  // Test: different constructor args produce different addresses
  await test('different constructor args produce different contract addresses', async () => {
    const provider = new MockNetworkProvider();
    const artifact = compileFile(path.join(CONTRACTS_DIR, 'savings-vault.cash'));

    const contract1 = new Contract(artifact, [ownerPkh, 500_000_000n], { provider });
    const contract2 = new Contract(artifact, [buyerPkh, 500_000_000n], { provider });
    const contract3 = new Contract(artifact, [ownerPkh, 600_000_000n], { provider });

    if (contract1.address === contract2.address) throw new Error('Different owners should have different addresses');
    if (contract1.address === contract3.address) throw new Error('Different locktimes should have different addresses');
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('============================================================');
  console.log('  BCH Pay — CashScript Contract Tests');
  console.log('  Using MockNetworkProvider (no network required)');
  console.log('============================================================');

  await testPaymentGateway();
  await testEscrow();
  await testSplitPayment();
  await testSavingsVault();
  await testEdgeCases();

  console.log('\n============================================================');
  console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  if (failed === 0) {
    console.log('  ✓ All tests passed!');
  } else {
    console.log('  ✗ Some tests failed:');
    for (const err of errors) {
      console.log(`    - ${err}`);
    }
  }
  console.log('============================================================');

  process.exit(failed > 0 ? 1 : 0);
}

main();
