import type { Merchant } from "@prisma/client";

/**
 * Hono environment type declaration.
 * Defines variables set by authMiddleware.
 */
export type AppEnv = {
  Variables: {
    merchant: Merchant;
    merchantId: string;
  };
};
