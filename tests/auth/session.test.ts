import { describe, expect, it } from "vitest";
import {
  createRotatedSessionToken,
  issueSessionToken,
  sessionStateFromClaims,
  verifySessionToken,
  type SessionStateReader,
} from "../../lib/auth/session";

const secret = "standard-session-test-secret-with-more-than-32-characters";
const now = new Date("2026-07-24T12:00:00.000Z");

describe("signed standard sessions", () => {
  it("verifies signed claims and detects signature tampering", async () => {
    const issued = await issueSessionToken(
      {
        sessionId: "session_12345678",
        userId: "user_12345678",
        email: "Editor@Example.com",
        displayName: "Editor",
        now,
        ttlSeconds: 3_600,
        rotationSeconds: 600,
      },
      secret,
    );

    const verification = await verifySessionToken(issued.token, {
      secret,
      now: new Date("2026-07-24T12:05:00.000Z"),
    });
    expect(verification.valid).toBe(true);
    if (verification.valid) {
      expect(verification.claims.email).toBe("editor@example.com");
      expect(verification.needsRotation).toBe(false);
    }

    const tampered = `${issued.token.slice(0, -1)}${
      issued.token.endsWith("A") ? "B" : "A"
    }`;
    await expect(
      verifySessionToken(tampered, { secret, now }),
    ).resolves.toEqual({ valid: false, reason: "bad_signature" });
  });

  it("rejects expired, revoked, and stale-auth-version tokens", async () => {
    const issued = await issueSessionToken(
      {
        sessionId: "session_abcdefgh",
        userId: "user_abcdefgh",
        email: "owner@example.com",
        now,
        ttlSeconds: 600,
        rotationSeconds: 60,
        authVersion: 3,
      },
      secret,
    );
    expect(
      await verifySessionToken(issued.token, {
        secret,
        now: new Date("2026-07-24T12:11:00.000Z"),
      }),
    ).toEqual({ valid: false, reason: "expired" });

    const revokedReader: SessionStateReader = {
      async readSessionState() {
        return {
          ...sessionStateFromClaims(issued.claims),
          revokedAt: issued.claims.issuedAt + 10,
        };
      },
    };
    expect(
      await verifySessionToken(issued.token, {
        secret,
        now: new Date("2026-07-24T12:05:00.000Z"),
        stateReader: revokedReader,
      }),
    ).toEqual({ valid: false, reason: "revoked" });

    const staleReader: SessionStateReader = {
      async readSessionState() {
        return {
          ...sessionStateFromClaims(issued.claims),
          authVersion: 4,
        };
      },
    };
    expect(
      await verifySessionToken(issued.token, {
        secret,
        now: new Date("2026-07-24T12:05:00.000Z"),
        stateReader: staleReader,
      }),
    ).toEqual({ valid: false, reason: "stale" });
  });

  it("marks rotation windows and issues a distinct replacement session", async () => {
    const issued = await issueSessionToken(
      {
        sessionId: "session_rotation1",
        userId: "user_rotation123",
        email: "owner@example.com",
        now,
        ttlSeconds: 3_600,
        rotationSeconds: 60,
      },
      secret,
    );
    const verification = await verifySessionToken(issued.token, {
      secret,
      now: new Date("2026-07-24T12:02:00.000Z"),
    });
    expect(verification.valid && verification.needsRotation).toBe(true);
    if (!verification.valid) throw new Error("Expected a valid session.");

    const rotated = await createRotatedSessionToken(verification, {
      secret,
      now: new Date("2026-07-24T12:02:00.000Z"),
    });
    expect(rotated.previousSessionId).toBe(issued.claims.sessionId);
    expect(rotated.claims.sessionId).not.toBe(issued.claims.sessionId);
    expect(rotated.token).not.toBe(issued.token);
  });
});
