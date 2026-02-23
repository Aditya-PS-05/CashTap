import { Hono } from "hono";
import { getBchPrice } from "../services/price.js";

const price = new Hono();

/**
 * GET /api/price
 * Returns current BCH/USD price (public, no auth required).
 */
price.get("/", async (c) => {
  try {
    const { usd, updatedAt } = await getBchPrice();
    return c.json({
      bch_usd: usd,
      updated_at: updatedAt.toISOString(),
    });
  } catch (err) {
    return c.json({ error: "Price data unavailable" }, 503);
  }
});

export default price;
