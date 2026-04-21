// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { webcrypto } from "crypto";
import { SignJWT } from "jose";

// Node 18 doesn't expose globalThis.crypto by default; jose's webapi build needs it
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

vi.mock("server-only", () => ({}));

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({ get: mockGet, set: mockSet, delete: mockDelete })
  ),
}));

import {
  createSession,
  getSession,
  deleteSession,
  verifySession,
} from "@/lib/auth";
import { NextRequest } from "next/server";

const DEV_SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(userId: string, email: string, expiresIn = "7d") {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return new SignJWT({ userId, email, expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(DEV_SECRET);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// createSession
test("createSession sets an httpOnly cookie with a JWT", async () => {
  await createSession("user-1", "a@example.com");

  expect(mockSet).toHaveBeenCalledOnce();
  const [name, token, options] = mockSet.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(typeof token).toBe("string");
  expect(token.split(".")).toHaveLength(3); // JWT format
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
});

test("createSession cookie expires ~7 days from now", async () => {
  const before = Date.now();
  await createSession("user-1", "a@example.com");
  const after = Date.now();

  const [, , options] = mockSet.mock.calls[0];
  const expires: Date = options.expires;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

// getSession
test("getSession returns null when no cookie is present", async () => {
  mockGet.mockReturnValue(undefined);
  expect(await getSession()).toBeNull();
});

test("getSession returns null for an invalid token", async () => {
  mockGet.mockReturnValue({ value: "not.a.jwt" });
  expect(await getSession()).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  const token = await makeToken("user-1", "a@example.com", "-1s");
  mockGet.mockReturnValue({ value: token });
  expect(await getSession()).toBeNull();
});

test("getSession returns session payload for a valid token", async () => {
  const token = await makeToken("user-42", "hello@example.com");
  mockGet.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session?.userId).toBe("user-42");
  expect(session?.email).toBe("hello@example.com");
});

// deleteSession
test("deleteSession removes the auth-token cookie", async () => {
  await deleteSession();
  expect(mockDelete).toHaveBeenCalledOnce();
  expect(mockDelete).toHaveBeenCalledWith("auth-token");
});

// verifySession
test("verifySession returns null when no cookie in request", async () => {
  const req = new NextRequest("http://localhost/");
  expect(await verifySession(req)).toBeNull();
});

test("verifySession returns null for an invalid token in request", async () => {
  const req = new NextRequest("http://localhost/", {
    headers: { Cookie: "auth-token=bad.token.here" },
  });
  expect(await verifySession(req)).toBeNull();
});

test("verifySession returns session payload for a valid token in request", async () => {
  const token = await makeToken("user-99", "req@example.com");
  const req = new NextRequest("http://localhost/", {
    headers: { Cookie: `auth-token=${token}` },
  });

  const session = await verifySession(req);
  expect(session?.userId).toBe("user-99");
  expect(session?.email).toBe("req@example.com");
});
