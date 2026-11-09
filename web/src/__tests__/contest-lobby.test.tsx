import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CountdownTimer } from "../app/contests/_components/countdown-timer";
import { ContestRegisterButton } from "../app/contests/[id]/_components/contest-register-button";

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock actions
vi.mock("../app/contests/_components/actions", () => ({
  registerContestAction: vi.fn().mockResolvedValue({ success: true }),
  unregisterContestAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe("CountdownTimer Leaf Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates remaining time corrected by server time offset", () => {
    const clientNow = 1000000;
    vi.setSystemTime(clientNow);

    // Server time is 5 seconds ahead of client time
    const serverTime = new Date(clientNow + 5000).toISOString();
    // Target is 65 seconds ahead of server time (so 65 seconds remaining)
    const targetTime = new Date(clientNow + 70000).toISOString();

    render(
      <CountdownTimer targetTime={targetTime} serverTime={serverTime} />
    );

    // 65 seconds remaining -> 00:01:05
    expect(screen.getByText("00:01:05")).toBeDefined();

    // Advance 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("00:01:00")).toBeDefined();
  });

  it("calls onComplete when timer reaches zero", () => {
    const clientNow = 1000000;
    vi.setSystemTime(clientNow);

    const serverTime = new Date(clientNow).toISOString();
    const targetTime = new Date(clientNow + 2000).toISOString();
    const onComplete = vi.fn();

    render(
      <CountdownTimer
        targetTime={targetTime}
        serverTime={serverTime}
        onComplete={onComplete}
      />
    );

    expect(screen.getByText("00:00:02")).toBeDefined();
    expect(onComplete).not.toHaveBeenCalled();

    // Advance 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onComplete).toHaveBeenCalled();
  });
});

describe("ContestRegisterButton Component", () => {
  it("prompts unauthenticated users to log in with next redirect", () => {
    render(
      <ContestRegisterButton
        contestId={10}
        status="upcoming"
        isRegistered={false}
        isLoggedIn={false}
      />
    );

    const link = screen.getByRole("link", { name: /Log in to Register/i });
    expect(link.getAttribute("href")).toBe("/login?next=/contests/10");
  });

  it("shows Register button for authenticated, unregistered users", () => {
    render(
      <ContestRegisterButton
        contestId={10}
        status="upcoming"
        isRegistered={false}
        isLoggedIn={true}
      />
    );

    expect(screen.getByRole("button", { name: /Register for Contest/i })).toBeDefined();
  });

  it("shows Registered badge and Unregister button for upcoming contest", () => {
    render(
      <ContestRegisterButton
        contestId={10}
        status="upcoming"
        isRegistered={true}
        isLoggedIn={true}
      />
    );

    expect(screen.getByText("Registered")).toBeDefined();
    expect(screen.getByRole("button", { name: /Unregister/i })).toBeDefined();
  });

  it("shows Enter Arena button for live contest when registered", () => {
    render(
      <ContestRegisterButton
        contestId={10}
        status="live"
        isRegistered={true}
        isLoggedIn={true}
      />
    );

    expect(screen.getByText("Registered")).toBeDefined();
    const arenaLink = screen.getByRole("link", { name: /Enter Arena/i });
    expect(arenaLink.getAttribute("href")).toBe("/contests/10/arena");
  });
});

