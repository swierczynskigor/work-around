import { PinState, PinStatus } from "../domain/models";
import { matchesDomain, parseHostname } from "./policies";

const ITERATIONS = 600_000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;
export class PinError extends Error {
  constructor(
    public code: string,
    public lockedUntil?: number,
  ) {
    super(code);
  }
}
export function requiresPin(
  hostname: string | null,
  state: PinState | null,
): boolean {
  return (
    !!hostname &&
    !!state?.protectedDomains.some((domain) => matchesDomain(hostname, domain))
  );
}
export function pinStatus(state: PinState | null): PinStatus {
  return {
    isConfigured: !!state,
    protectedDomains: state?.protectedDomains || [],
    lockedUntil: state?.lockedUntil || 0,
  };
}
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bytes = Uint8Array.from(salt.match(/.{2}/g) || [], (pair) =>
    parseInt(pair, 16),
  );
  const result = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: bytes, iterations: ITERATIONS },
    key,
    256,
  );
  return hex(new Uint8Array(result));
}
function sameHash(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
interface PinRepository {
  getPinState(): Promise<PinState | null>;
  savePinState(state: PinState | null): Promise<void>;
}
/** Called only from the background's serialized command queue. Credentials stay local. */
export class PinService {
  constructor(private repository: PinRepository) {}
  async verify(pin: unknown): Promise<void> {
    const state = await this.repository.getPinState();
    if (!state) throw new PinError("PIN_NOT_CONFIGURED");
    if (state.lockedUntil > Date.now())
      throw new PinError("PIN_LOCKED", state.lockedUntil);
    const valid =
      typeof pin === "string" &&
      /^\d{4,8}$/.test(pin) &&
      sameHash(await hashPin(pin, state.salt), state.hash);
    if (!valid) {
      state.failedAttempts += 1;
      if (state.failedAttempts >= MAX_ATTEMPTS) {
        state.failedAttempts = 0;
        state.lockedUntil = Date.now() + LOCK_MS;
      }
      await this.repository.savePinState(state);
      throw new PinError(
        state.lockedUntil > Date.now() ? "PIN_LOCKED" : "PIN_INVALID",
        state.lockedUntil,
      );
    }
    state.failedAttempts = 0;
    state.lockedUntil = 0;
    await this.repository.savePinState(state);
  }
  async configure(
    currentPin: unknown,
    newPin: unknown,
    domains: unknown,
  ): Promise<PinStatus> {
    const old = await this.repository.getPinState();
    if (old) await this.verify(currentPin);
    if (
      !Array.isArray(domains) ||
      domains.length > 100 ||
      domains.some((value) => typeof value !== "string")
    )
      throw new PinError("PIN_DOMAINS");
    let protectedDomains: string[];
    try {
      protectedDomains = [
        ...new Set(domains.map((value) => parseHostname(value))),
      ];
    } catch {
      throw new PinError("PIN_DOMAINS");
    }
    if (
      (!old || (newPin !== undefined && newPin !== "")) &&
      (typeof newPin !== "string" || !/^\d{4,8}$/.test(newPin))
    )
      throw new PinError("PIN_FORMAT");
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const state: PinState =
      typeof newPin === "string" && newPin !== ""
        ? {
            version: 1,
            salt,
            hash: await hashPin(newPin, salt),
            iterations: ITERATIONS,
            protectedDomains,
            failedAttempts: 0,
            lockedUntil: 0,
          }
        : { ...old!, protectedDomains, failedAttempts: 0, lockedUntil: 0 };
    await this.repository.savePinState(state);
    return pinStatus(state);
  }
  async remove(currentPin: unknown): Promise<PinStatus> {
    await this.verify(currentPin);
    await this.repository.savePinState(null);
    return pinStatus(null);
  }
}
