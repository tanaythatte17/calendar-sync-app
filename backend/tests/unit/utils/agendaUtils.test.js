import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// agendaUtils.js constructs a real Agenda instance (which opens its own
// MongoDB connection) as a side effect of being imported, and it imports
// googleService.js / microsoftService.js purely to reference their renewal
// functions inside job callbacks. None of that is relevant to what we're
// testing here (the renewal-scheduling math), so we mock all three to keep
// this a fast, network-free unit test.
const scheduleMock = vi.fn();
const defineMock = vi.fn();

class MockAgenda {
  define(...args) {
    return defineMock(...args);
  }
  schedule(...args) {
    return scheduleMock(...args);
  }
  start() {}
  stop() {}
}

vi.mock("agenda", () => ({ default: MockAgenda }));
vi.mock("../../../services/googleService.js", () => ({
  renewNotification: vi.fn(),
}));
vi.mock("../../../services/microsoftService.js", () => ({
  renewMicrosoftNotification: vi.fn(),
}));

describe("agendaUtils renewal scheduling", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Each test re-imports a fresh module instance so that the top-level
    // agenda.define(...) calls run again and get recorded by defineMock —
    // otherwise, since ES modules are cached, only the very first import in
    // this file would ever register them.
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules Google renewal 2 hours before channel expiration", async () => {
    const { scheduleRenewal } = await import("../../../utils/agendaUtils.js");
    const expiration = new Date("2026-01-05T12:00:00Z").getTime();

    await scheduleRenewal(expiration, "account-1", "events", "cal-1", "channel-1", "resource-1");

    expect(scheduleMock).toHaveBeenCalledWith(
      new Date("2026-01-05T10:00:00Z"),
      "renewGoogleNotification",
      {
        accountId: "account-1",
        channelType: "events",
        calendarId: "cal-1",
        channelId: "channel-1",
        resourceId: "resource-1",
      }
    );
  });

  it("schedules Microsoft renewal 1 hour before subscription expiration", async () => {
    const { scheduleMicrosoftRenewal } = await import("../../../utils/agendaUtils.js");
    const expiration = new Date("2026-01-05T12:00:00Z").getTime();

    await scheduleMicrosoftRenewal(expiration, "account-1", "events", "cal-1", "subscription-1");

    expect(scheduleMock).toHaveBeenCalledWith(
      new Date("2026-01-05T11:00:00Z"),
      "renewMicrosoftNotification",
      {
        accountId: "account-1",
        subscriptionType: "events",
        calendarId: "cal-1",
        subscriptionId: "subscription-1",
      }
    );
  });

  it("registers job handlers for both providers on module load", async () => {
    await import("../../../utils/agendaUtils.js");

    const registeredJobNames = defineMock.mock.calls.map(([jobName]) => jobName);
    expect(registeredJobNames).toEqual(
      expect.arrayContaining(["renewGoogleNotification", "renewMicrosoftNotification"])
    );
  });
});
