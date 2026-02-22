/**
 * BCH Pay — Contract Compiler
 *
 * Compiles all CashScript .cash contracts and outputs artifact JSON files
 * to the artifacts/ directory. Each artifact contains the compiled bytecode,
 * ABI, and constructor parameters needed for contract instantiation.
 *
 * Usage:
 *   npx tsx src/compile.ts
 *   npm run compile
 */

import { compileFile } from 'cashc';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories
const CONTRACTS_DIR = path.resolve(__dirname, '..', 'contracts');
const ARTIFACTS_DIR = path.resolve(__dirname, '..', 'artifacts');

// List of all contracts to compile
const CONTRACT_FILES = [
  'payment-gateway.cash',
  'escrow.cash',
  'split-payment.cash',
  'savings-vault.cash',
];

/**
 * Ensure the artifacts output directory exists.
 */
function ensureArtifactsDir(): void {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    console.log(`Created artifacts directory: ${ARTIFACTS_DIR}`);
  }
}

/**
 * Compile a single CashScript contract file and write the artifact JSON.
 *
 * @param filename - The .cash file name (e.g. "escrow.cash")
 * @returns true if compilation succeeded, false otherwise
 */
function compileContract(filename: string): boolean {
  const contractPath = path.join(CONTRACTS_DIR, filename);
  const artifactName = filename.replace('.cash', '.json');
  const artifactPath = path.join(ARTIFACTS_DIR, artifactName);

  console.log(`\nCompiling: ${filename}`);
  console.log(`  Source:   ${contractPath}`);
  console.log(`  Output:   ${artifactPath}`);

  // Verify the source file exists
  if (!fs.existsSync(contractPath)) {
    console.error(`  ERROR: Source file not found: ${contractPath}`);
    return false;
  }

  try {
    // compileFile() reads the .cash file and returns an Artifact object.
    // The Artifact contains: contractName, constructorInputs, abi, bytecode,
    // source, compiler info, and updatedAt timestamp.
    const artifact = compileFile(contractPath);

    // Write the artifact as formatted JSON
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

    console.log(`  SUCCESS: ${artifact.contractName} compiled`);
    console.log(`  Bytecode size: ${artifact.bytecode.length} chars`);
    console.log(`  ABI functions: ${artifact.abi.map((f: { name: string }) => f.name).join(', ')}`);

    return true;
  } catch (error) {
    console.error(`  ERROR: Compilation failed for ${filename}`);
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    } else {
      console.error(`  ${String(error)}`);
    }
    return false;
  }
}

/**
 * Main entry point: compile all contracts.
 */
function main(): void {
  console.log('========================================');
  console.log('  BCH Pay — CashScript Contract Compiler');
  console.log('========================================');
  console.log(`Contracts directory: ${CONTRACTS_DIR}`);
  console.log(`Artifacts directory: ${ARTIFACTS_DIR}`);
  console.log(`Contracts to compile: ${CONTRACT_FILES.length}`);

  ensureArtifactsDir();

  let successCount = 0;
  let failCount = 0;

  for (const file of CONTRACT_FILES) {
    const success = compileContract(file);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n========================================');
  console.log(`  Results: ${successCount} succeeded, ${failCount} failed`);
  console.log('========================================');

  if (failCount > 0) {
    console.log('\nSome contracts failed to compile. Check the errors above.');
    process.exit(1);
  } else {
    console.log('\nAll contracts compiled successfully!');
    console.log(`Artifacts written to: ${ARTIFACTS_DIR}`);
  }
}

main();
