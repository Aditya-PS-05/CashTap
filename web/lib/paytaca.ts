export interface PaytacaProvider {
  getAddress(): Promise<string>;
  signMessage(message: string): Promise<string>;
}

declare global {
  interface Window {
    paytaca?: PaytacaProvider;
    bitcoin?: PaytacaProvider;
  }
}

export function isPaytacaAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.paytaca || window.bitcoin);
}

export async function connectPaytaca(): Promise<{
  address: string;
  signMessage: (message: string) => Promise<string>;
}> {
  const provider = window.paytaca || window.bitcoin;
  if (!provider) {
    throw new Error("Paytaca wallet extension not found. Please install it from paytaca.com");
  }

  const address = await provider.getAddress();
  return {
    address,
    signMessage: (message: string) => provider.signMessage(message),
  };
}
