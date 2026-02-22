import { describe, it, expect } from "vitest";
import { createTestApp } from "../helpers/app.js";
import { prismaMock } from "../helpers/mock-prisma.js";
import { merchantFixture, deviceFixture } from "../helpers/fixtures.js";
import { makeToken } from "../helpers/auth.js";

const app = createTestApp();
const TOKEN = makeToken();
const authHeader = { Authorization: `Bearer ${TOKEN}` };

// ---------- POST /api/devices ----------

describe("POST /api/devices", () => {
  it("creates a new device and returns 201", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.device.findFirst.mockResolvedValue(null);
    prismaMock.device.create.mockResolvedValue(deviceFixture());

    const res = await app.request("/api/devices", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ device_token: "fcm-token-test-12345", platform: "ANDROID" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.device.device_token).toBe("fcm-token-test-12345");
  });

  it("reactivates existing device and returns 200", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.device.findFirst.mockResolvedValue(deviceFixture({ active: false }));
    prismaMock.device.update.mockResolvedValue(deviceFixture({ active: true }));

    const res = await app.request("/api/devices", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ device_token: "fcm-token-test-12345", platform: "ANDROID" }),
    });
    expect(res.status).toBe(200);
  });

  it("returns 400 for missing device_token", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/devices", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "ANDROID" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid platform", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/devices", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ device_token: "tok", platform: "WINDOWS" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_token: "tok", platform: "IOS" }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------- GET /api/devices ----------

describe("GET /api/devices", () => {
  it("returns list of devices", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.device.findMany.mockResolvedValue([deviceFixture()]);

    const res = await app.request("/api/devices", { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.devices).toHaveLength(1);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/devices");
    expect(res.status).toBe(401);
  });
});

// ---------- DELETE /api/devices/:id ----------

describe("DELETE /api/devices/:id", () => {
  it("deactivates a device", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.device.findFirst.mockResolvedValue(deviceFixture());
    prismaMock.device.update.mockResolvedValue(deviceFixture({ active: false }));

    const res = await app.request("/api/devices/cldev0000000000000001", {
      method: "DELETE",
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/deactivated/i);
  });

  it("returns 404 for non-owned device", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.device.findFirst.mockResolvedValue(null);

    const res = await app.request("/api/devices/doesntexist", {
      method: "DELETE",
      headers: authHeader,
    });
    expect(res.status).toBe(404);
  });
});

// ---------- POST /api/devices/test ----------

describe("POST /api/devices/test", () => {
  it("sends test push notification", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());

    const res = await app.request("/api/devices/test", {
      method: "POST",
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
