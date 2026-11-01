import test from "node:test";
import assert from "node:assert/strict";
import { PinState } from "../src/domain/models";
import {
  PinError,
  PinService,
  pinStatus,
  requiresPin,
} from "../src/services/PinService";
import { createFocusSchedule } from "../src/services/focus";
import { DEFAULT_SETTINGS, evaluatePolicy } from "../src/services/policies";

test("PIN setup, domain selection, credential changes and removal require the current PIN", async () => {
  let stored: PinState | null = null;
  const repository = {
    getPinState: async () => structuredClone(stored),
    savePinState: async (value: PinState | null) => {
      stored = structuredClone(value);
    },
  };
  const service = new PinService(repository);
  await assert.rejects(service.configure(undefined, "12", []), {
    code: "PIN_FORMAT",
  });
  const status = await service.configure(undefined, "012345", [
    "WWW.Example.COM",
    "example.com",
    "reddit.com",
  ]);
  assert.deepEqual(status.protectedDomains, ["example.com", "reddit.com"]);
  const first = await repository.getPinState();
  assert.ok(first && first.hash !== "012345" && first.salt.length === 32);
  assert.equal(JSON.stringify(first).includes("012345"), false);
  assert.deepEqual(Object.keys(pinStatus(first)).sort(), [
    "isConfigured",
    "lockedUntil",
    "protectedDomains",
  ]);
  assert.equal(requiresPin("sub.example.com", first), true);
  assert.equal(requiresPin("notexample.com", first), false);
  assert.equal(requiresPin("example.com.evil.com", first), false);
  await assert.rejects(service.configure("9999", undefined, []), {
    code: "PIN_INVALID",
  });
  assert.deepEqual(
    (await repository.getPinState())?.protectedDomains,
    status.protectedDomains,
  );
  await assert.rejects(service.remove(undefined), { code: "PIN_INVALID" });
  await service.configure("012345", "7654", ["reddit.com"]);
  await assert.rejects(service.verify("012345"), { code: "PIN_INVALID" });
  await service.verify("7654");
  await service.configure("7654", undefined, []);
  assert.equal(
    requiresPin("reddit.com", await repository.getPinState()),
    false,
  );
  await service.remove("7654");
  assert.equal(await repository.getPinState(), null);
});

test("PIN attempt throttling survives service restarts and expires after one minute", async () => {
  let stored: PinState | null = null;
  const repository = {
    getPinState: async () => structuredClone(stored),
    savePinState: async (value: PinState | null) => {
      stored = structuredClone(value);
    },
  };
  const service = new PinService(repository);
  await service.configure(undefined, "1234", ["example.com"]);
  for (let i = 0; i < 4; i++)
    await assert.rejects(service.verify("0000"), { code: "PIN_INVALID" });
  const before = Date.now();
  await assert.rejects(
    service.verify("0000"),
    (error: unknown) =>
      error instanceof PinError &&
      error.code === "PIN_LOCKED" &&
      error.lockedUntil! >= before + 60_000,
  );
  const restarted = new PinService(repository);
  await assert.rejects(restarted.verify("1234"), { code: "PIN_LOCKED" });
  await assert.rejects(restarted.remove("1234"), { code: "PIN_LOCKED" });
  const now = Date.now;
  try {
    Date.now = () => before + 60_100;
    await restarted.verify("1234");
  } finally {
    Date.now = now;
  }
  assert.equal((await repository.getPinState())?.failedAttempts, 0);
  assert.equal((await repository.getPinState())?.lockedUntil, 0);
});

test("focus editing preserves paused schedules and validates days and overnight hours", () => {
  const schedule = createFocusSchedule({
    id: "existing",
    name: " Evening ",
    start: "22:00",
    end: "02:00",
    days: [5],
    isEnabled: false,
  });
  assert.equal(schedule.id, "existing");
  assert.equal(schedule.name, "Evening");
  assert.equal(schedule.isEnabled, false);
  const settings = {
    ...DEFAULT_SETTINGS,
    blockedWindows: [{ ...schedule, isEnabled: true }],
  };
  const usage = { version: 2 as const, records: [], extensions: [] };
  assert.equal(
    evaluatePolicy(
      "https://example.com",
      settings,
      usage,
      new Date(2026, 9, 24, 1).getTime(),
    ).reason,
    "focus_mode",
  );
  assert.equal(
    evaluatePolicy(
      "https://example.com",
      settings,
      usage,
      new Date(2026, 9, 24, 3).getTime(),
    ).reason,
    "none",
  );
  for (const patch of [
    { days: [] },
    { end: "22:00" },
    { start: "25:00" },
    { days: [7] },
  ])
    assert.throws(() =>
      createFocusSchedule({
        name: "",
        start: "22:00",
        end: "02:00",
        days: [5],
        isEnabled: true,
        ...patch,
      }),
    );
});
