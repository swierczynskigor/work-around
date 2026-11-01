import test from "node:test";
import assert from "node:assert/strict";
import { ActivityTracker } from "../src/services/ActivityTracker";
import {
  DEFAULT_SETTINGS,
  dayKey,
  evaluatePolicy,
  isFocusBlocked,
  matchesException,
  normalizeSettings,
  usageForDomains,
} from "../src/services/policies";
import { UsageData, UsageRecord } from "../src/domain/models";
import {
  ChromeStorageRepository,
  USAGE_KEY,
} from "../src/data/ChromeStorageRepository";

const at = new Date(2026, 9, 18, 12).getTime();
const empty = (): UsageData => ({ version: 2, records: [], extensions: [] });
const record = (hostname: string, start: number, end: number): UsageRecord => ({
  id: crypto.randomUUID(),
  hostname,
  day: dayKey(start),
  startedAt: start,
  endedAt: end,
  durationMs: end - start,
  kind: "active",
});

test("counts observed activity, ignores sleep, backward clock changes and a restarted worker", () => {
  const tracker = new ActivityTracker(),
    target = [{ hostname: "example.com", kind: "active" as const }];
  assert.deepEqual(tracker.sample(at, target), []);
  assert.equal(tracker.sample(at + 5000, target)[0].durationMs, 5000);
  assert.deepEqual(tracker.sample(at + 3600000, target), []);
  assert.equal(tracker.sample(at + 3605000, target)[0].durationMs, 5000);
  assert.deepEqual(tracker.sample(at - 1000, target), []);
  tracker.reset();
  assert.deepEqual(tracker.sample(at + 3610000, target), []);
});
test("does not count paused intervals or duplicate tabs on one domain", () => {
  const tracker = new ActivityTracker(),
    target = { hostname: "example.com", kind: "active" as const };
  tracker.sample(at, [target, target]);
  assert.equal(tracker.sample(at + 5000, [target, target]).length, 1);
  assert.deepEqual(tracker.sample(at + 10000, []), []);
  assert.deepEqual(tracker.sample(at + 15000, [target]), []);
  assert.equal(tracker.sample(at + 20000, [target])[0].durationMs, 5000);
});
test("closes a known tab or focus transition without dropping the last observed seconds", () => {
  const tracker = new ActivityTracker();
  tracker.sample(at, [{ hostname: "first.test", kind: "active" }]);
  const intervals = tracker.sample(
    at + 2000,
    [{ hostname: "second.test", kind: "active" }],
    true,
  );
  assert.equal(intervals[0].hostname, "first.test");
  assert.equal(intervals[0].durationMs, 2000);
  assert.deepEqual(tracker.sample(at + 3600000, [], true), []);
});
test("splits an interval across local midnight and daylight-saving transitions", () => {
  const tracker = new ActivityTracker(),
    target = [{ hostname: "example.com", kind: "active" as const }];
  const start = new Date(2026, 9, 18, 23, 59, 57).getTime();
  tracker.sample(start, target);
  const records = tracker.sample(start + 5000, target);
  assert.deepEqual(
    records.map((record) => [record.day, record.durationMs]),
    [
      ["2026-10-18", 3000],
      ["2026-10-19", 2000],
    ],
  );
  const dst = new Date("2026-10-25T00:59:58Z").getTime();
  tracker.reset();
  tracker.sample(dst, target);
  assert.equal(tracker.sample(dst + 5000, target)[0].durationMs, 5000);
});
test("shared budgets count overlapping activity once and include all subdomains", () => {
  const data = empty();
  data.records = [
    record("www.youtube.com", at, at + 10000),
    record("old.reddit.com", at + 5000, at + 15000),
  ];
  assert.equal(
    usageForDomains(data.records, ["youtube.com", "reddit.com"], dayKey(at)),
    15000,
  );
  const settings = normalizeSettings({
    groups: [
      {
        id: "social",
        name: "Social",
        hostnames: ["youtube.com", "reddit.com"],
        dailyLimitMs: 15000,
      },
    ],
  });
  assert.equal(
    evaluatePolicy("https://reddit.com/", settings, data, at + 20000).reason,
    "time_limit",
  );
  assert.equal(
    evaluatePolicy("https://notreddit.com/", settings, data, at + 20000).reason,
    "none",
  );
  data.records.pop();
  assert.equal(
    evaluatePolicy("https://reddit.com/", settings, data, at + 20000)
      .remainingMs,
    5000,
  );
});
test("most specific site rule and tightest overlapping group win", () => {
  const settings = normalizeSettings({
    limits: [
      { hostname: "example.com", dailyLimitMs: 60000 },
      { hostname: "news.example.com", dailyLimitMs: 120000 },
    ],
    groups: [
      {
        id: "g",
        name: "Group",
        hostnames: ["example.com"],
        dailyLimitMs: 30000,
      },
    ],
  });
  assert.equal(
    evaluatePolicy("https://news.example.com/", settings, empty(), at)
      .budgetName,
    "Group",
  );
  settings.groups = [];
  assert.equal(
    evaluatePolicy("https://news.example.com/", settings, empty(), at).limitMs,
    120000,
  );
});
test("URL exceptions respect origin, path boundaries and exact optional query parameters", () => {
  const exceptions = [
    "https://www.youtube.com/watch?v=lesson",
    "https://example.com/work",
  ];
  assert.equal(
    matchesException("https://youtube.com/watch?v=lesson", exceptions),
    true,
  );
  assert.equal(
    matchesException("https://youtube.com/watch?v=distraction", exceptions),
    false,
  );
  assert.equal(
    matchesException("https://example.com/work/item", exceptions),
    true,
  );
  assert.equal(
    matchesException("https://example.com/workaround", exceptions),
    false,
  );
  assert.equal(
    matchesException("https://example.com.evil.test/work", exceptions),
    false,
  );
  assert.equal(matchesException("http://example.com/work", exceptions), false);
});
test("overnight focus hours belong to the starting weekday and expose the actual end", () => {
  const settings = normalizeSettings({
    blockedWindows: [
      {
        id: "night",
        startHour: 23,
        startMinute: 0,
        endHour: 7,
        endMinute: 0,
        daysOfWeek: [1],
        isEnabled: true,
      },
    ],
  });
  const monday = new Date(2026, 9, 19, 23, 30).getTime(),
    tuesday = new Date(2026, 9, 20, 6, 30).getTime();
  assert.equal(isFocusBlocked(settings, monday), true);
  assert.equal(isFocusBlocked(settings, tuesday), true);
  assert.equal(
    isFocusBlocked(settings, new Date(2026, 9, 19, 6, 30).getTime()),
    false,
  );
  assert.equal(
    evaluatePolicy("https://example.com/", settings, empty(), tuesday).resetAt,
    new Date(2026, 9, 20, 7).getTime(),
  );
});
test("extensions expire, obey strict mode and cannot bypass focus hours or Shorts", () => {
  const settings = normalizeSettings({
      limits: [{ hostname: "youtube.com", dailyLimitMs: 1000 }],
    }),
    data = empty();
  data.records = [record("youtube.com", at - 2000, at)];
  assert.equal(
    evaluatePolicy("https://youtube.com/", settings, data, at).canExtend,
    true,
  );
  settings.strictMode = true;
  assert.equal(
    evaluatePolicy("https://youtube.com/", settings, data, at).canExtend,
    false,
  );
  settings.strictMode = false;
  data.extensions.push({
    id: "e",
    hostname: "youtube.com",
    day: dayKey(at),
    expiresAt: at + 300000,
  });
  assert.equal(
    evaluatePolicy("https://youtube.com/", settings, data, at).reason,
    "none",
  );
  assert.equal(
    evaluatePolicy("https://youtube.com/", settings, data, at + 300000).reason,
    "time_limit",
  );
  assert.equal(
    evaluatePolicy("https://youtube.com/", settings, data, at + 300000)
      .canExtend,
    false,
  );
  settings.strictMode = true;
  assert.equal(
    evaluatePolicy("https://youtube.com/", settings, data, at).reason,
    "time_limit",
  );
  settings.strictMode = false;
  settings.blockYouTubeShorts = true;
  assert.equal(
    evaluatePolicy("https://youtube.com/shorts/x", settings, data, at).reason,
    "youtube_shorts",
  );
  settings.urlExceptions = ["https://youtube.com/shorts/x"];
  assert.equal(
    evaluatePolicy("https://youtube.com/shorts/x", settings, data, at).reason,
    "none",
  );
});
test("explicitly disabling blocking and fresh-day budgets are respected", () => {
  const settings = normalizeSettings({
    isBlockingEnabled: false,
    blockYouTubeShorts: true,
  });
  assert.equal(
    evaluatePolicy("https://youtube.com/shorts/x", settings, empty(), at)
      .reason,
    "none",
  );
  const data = empty();
  data.records = [record("example.com", at, at + 10000)];
  const limit = {
    ...DEFAULT_SETTINGS,
    limits: [{ hostname: "example.com", dailyLimitMs: 1000 }],
  };
  assert.equal(
    evaluatePolicy("https://example.com/", limit, data, at + 86400000).usedMs,
    0,
  );
});
test("migrates legacy totals once, coalesces samples and recovers after a storage failure", async () => {
  const local: Record<string, unknown> = {
    workaround_stats: [
      {
        hostname: "www.example.com",
        timeSpentMs: 5000,
        lastVisited: Date.now(),
      },
      { hostname: "example.com", timeSpentMs: 6000, lastVisited: Date.now() },
    ],
  };
  let fail = false;
  Object.assign(globalThis, {
    chrome: {
      storage: {
        local: {
          get: async (key: string | string[]) =>
            structuredClone(
              Object.fromEntries(
                (Array.isArray(key) ? key : [key]).map((key) => [
                  key,
                  local[key],
                ]),
              ),
            ),
          set: async (value: Record<string, unknown>) => {
            if (fail) {
              fail = false;
              throw new Error("Storage unavailable");
            }
            Object.assign(local, structuredClone(value));
          },
        },
      },
    },
  });
  const repository = new ChromeStorageRepository();
  await repository.migrate();
  await repository.migrate();
  assert.equal((await repository.getUsage()).records.length, 1);
  assert.equal((await repository.getUsage()).records[0].durationMs, 6000);
  const now = Date.now();
  await repository.appendIntervals([
    { ...record("example.com", now, now + 5000) },
  ]);
  await repository.appendIntervals([
    { ...record("example.com", now + 5000, now + 10000) },
  ]);
  assert.equal((await repository.getUsage()).records.length, 2);
  fail = true;
  await assert.rejects(
    repository.mutateUsage((data) => {
      data.records = [];
    }),
  );
  await repository.mutateUsage((data) => {
    data.records = data.records.filter((record) => record.kind === "legacy");
  });
  assert.equal((await repository.getAllStatsForToday())[0].timeSpentMs, 6000);
  assert.ok(local[USAGE_KEY]);
});

test("Facebook's 18:00–23:00 window blocks morning and boundary access across subdomains", () => {
  const settings = normalizeSettings({
    limits: [
      {
        hostname: "www.facebook.com",
        dailyLimitMs: 3_600_000,
        allowedTimeWindows: [
          { startHour: 18, startMinute: 0, endHour: 23, endMinute: 0 },
        ],
      },
    ],
  });
  for (const hostname of [
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",
    "web.facebook.com",
  ]) {
    for (const [hour, minute, reason] of [
      [8, 0, "outside_hours"],
      [17, 59, "outside_hours"],
      [18, 0, "none"],
      [22, 59, "none"],
      [23, 0, "outside_hours"],
    ] as const) {
      const now = new Date(2026, 9, 30, hour, minute).getTime();
      const result = evaluatePolicy(
        `https://${hostname}/`,
        settings,
        empty(),
        now,
      );
      assert.equal(result.reason, reason, `${hostname} at ${hour}:${minute}`);
      if (reason === "outside_hours") assert.equal(result.canExtend, false);
    }
  }
  const morning = new Date(2026, 9, 30, 8).getTime();
  assert.equal(
    evaluatePolicy("https://www.facebook.com/", settings, empty(), morning)
      .resetAt,
    new Date(2026, 9, 30, 18).getTime(),
  );
});


test("blocking defaults on independently of tracking in fresh and legacy settings", () => {
  const morning = new Date(2026, 10, 1, 8).getTime();
  const limits = [
    {
      hostname: "facebook.com",
      dailyLimitMs: 3_600_000,
      allowedTimeWindows: [
        { startHour: 18, startMinute: 0, endHour: 23, endMinute: 0 },
      ],
    },
  ];
  assert.equal(normalizeSettings().isBlockingEnabled, true);
  for (const isTrackingEnabled of [true, false]) {
    const legacy = normalizeSettings({ isTrackingEnabled, limits });
    assert.equal(
      evaluatePolicy("https://www.facebook.com/", legacy, empty(), morning).reason,
      "outside_hours",
    );
    const disabled = normalizeSettings({
      isTrackingEnabled,
      isBlockingEnabled: false,
      limits,
    });
    assert.equal(
      evaluatePolicy("https://www.facebook.com/", disabled, empty(), morning).reason,
      "none",
      "an explicit blocking preference is preserved",
    );
  }
});
