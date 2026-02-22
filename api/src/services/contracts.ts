// Contract Service
// Loads CashScript artifacts and creates contract instances on demand.
// The API acts as the intermediary — web/mobile never access artifacts directly.

import {
  ElectrumNetworkProvider,
  Contract,
  type NetworkProvider,
  type Artifact,
} from "cashscript";

import paymentGatewayArtifact from "../contracts/payment-gateway.json" with { type: "json" };
import escrowArtifact from "../contracts/escrow.json" with { type: "json" };
import splitPaymentArtifact from "../contracts/split-payment.json" with { type: "json" };
import savingsVaultArtifact from "../contracts/savings-vault.json" with { type: "json" };

const NETWORK = (process.env.BCH_NETWORK || "chipnet") as "chipnet" | "mainnet";

let provider: NetworkProvider | null = null;

function getProvider(): NetworkProvider {
  if (!provider) {
    provider = new ElectrumNetworkProvider(NETWORK);
  }
  return provider;
}

const artifacts = {
  PAYMENT_GATEWAY: paymentGatewayArtifact as unknown as Artifact,
  ESCROW: escrowArtifact as unknown as Artifact,
  SPLIT_PAYMENT: splitPaymentArtifact as unknown as Artifact,
  SAVINGS_VAULT: savingsVaultArtifact as unknown as Artifact,
} as const;

type ContractTypeName = keyof typeof artifacts;

// ---------------------------------------------------------------------------
// Contract instance creators
// ---------------------------------------------------------------------------

export function getPaymentGatewayAddress(merchantPkh: string): {
  address: string;
  tokenAddress: string;
} {
  const contract = new Contract(artifacts.PAYMENT_GATEWAY, [merchantPkh], {
    provider: getProvider(),
  });
  return { address: contract.address, tokenAddress: contract.tokenAddress };
}

export function createEscrow(
  buyerPkh: string,
  sellerPkh: string,
  arbiterPkh: string,
  timeout: bigint
): { address: string; tokenAddress: string } {
  const contract = new Contract(
    artifacts.ESCROW,
    [buyerPkh, sellerPkh, arbiterPkh, timeout],
    { provider: getProvider() }
  );
  return { address: contract.address, tokenAddress: contract.tokenAddress };
}

export function createSplitPayment(
  recipient1Pkh: string,
  recipient2Pkh: string,
  split1: bigint,
  split2: bigint
): { address: string; tokenAddress: string } {
  const contract = new Contract(
    artifacts.SPLIT_PAYMENT,
    [recipient1Pkh, recipient2Pkh, split1, split2],
    { provider: getProvider() }
  );
  return { address: contract.address, tokenAddress: contract.tokenAddress };
}

export function createSavingsVault(
  ownerPkh: string,
  locktime: bigint
): { address: string; tokenAddress: string } {
  const contract = new Contract(
    artifacts.SAVINGS_VAULT,
    [ownerPkh, locktime],
    { provider: getProvider() }
  );
  return { address: contract.address, tokenAddress: contract.tokenAddress };
}

// ---------------------------------------------------------------------------
// Contract info (for frontend to know what params are needed)
// ---------------------------------------------------------------------------

export function getContractInfo(type: ContractTypeName) {
  const artifact = artifacts[type];
  return {
    contractName: artifact.contractName,
    constructorInputs: artifact.constructorInputs,
    abi: artifact.abi,
  };
}

export function getAllContractTypes() {
  return Object.keys(artifacts).map((type) => {
    const artifact = artifacts[type as ContractTypeName];
    return {
      type,
      contractName: artifact.contractName,
      constructorInputs: artifact.constructorInputs,
      abi: artifact.abi,
    };
  });
}

export const contractService = {
  getPaymentGatewayAddress,
  createEscrow,
  createSplitPayment,
  createSavingsVault,
  getContractInfo,
  getAllContractTypes,
};
