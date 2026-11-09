import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContestArenaTopbar } from "../app/contests/[id]/arena/_components/contest-arena-topbar";
import type { ContestProblem } from "@/types/contest";

const mockProblems: ContestProblem[] = [
  { id: 1, problem_id: 101, title: "Two Sum", difficulty: "easy", points: 100, position: 1 },
  { id: 2, problem_id: 102, title: "Median Array", difficulty: "hard", points: 200, position: 2 },
  { id: 3, problem_id: 103, title: "Graph Path", difficulty: "medium", points: 150, position: 3 },
];

describe("ContestArenaTopbar Component", () => {
  it("renders problem tabs with ARIA roles tablist and tab", () => {
    const onSelect = vi.fn();
    render(
      <ContestArenaTopbar
        title="Weekly Contest 1"
        contestId={1}
        problems={mockProblems}
        activeProblemIndex={0}
        onSelectProblem={onSelect}
        endTime="2026-11-10T12:00:00Z"
        serverTime="2026-11-10T10:00:00Z"
        onOpenLeaderboard={vi.fn()}
      />
    );

    const tablist = screen.getByRole("tablist", { name: /Contest Problems/i });
    expect(tablist).toBeDefined();

    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(3);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");
  });

  it("navigates tabs using ArrowLeft and ArrowRight keys", () => {
    const onSelect = vi.fn();
    render(
      <ContestArenaTopbar
        title="Weekly Contest 1"
        contestId={1}
        problems={mockProblems}
        activeProblemIndex={0}
        onSelectProblem={onSelect}
        endTime="2026-11-10T12:00:00Z"
        serverTime="2026-11-10T10:00:00Z"
        onOpenLeaderboard={vi.fn()}
      />
    );

    const tabs = screen.getAllByRole("tab");

    // Press ArrowRight on P1 -> selects P2
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(onSelect).toHaveBeenCalledWith(1);

    // Press ArrowLeft on P1 -> wraps to P3
    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("displays solved checkmark and attempt badge based on problemStates", () => {
    const problemStates = {
      101: { is_solved: true, attempts: 2 },
      102: { is_solved: false, attempts: 3 },
      103: { is_solved: false, attempts: 0 },
    };

    render(
      <ContestArenaTopbar
        title="Weekly Contest 1"
        contestId={1}
        problems={mockProblems}
        activeProblemIndex={0}
        onSelectProblem={vi.fn()}
        endTime="2026-11-10T12:00:00Z"
        serverTime="2026-11-10T10:00:00Z"
        onOpenLeaderboard={vi.fn()}
        problemStates={problemStates}
      />
    );

    // P1 is solved -> has Solved title
    expect(screen.getByTitle("Solved")).toBeDefined();

    // P2 is attempted 3 times
    expect(screen.getByTitle("3 attempts")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();

    // P3 is unattempted -> no attempt badge
    expect(screen.queryByTitle("0 attempts")).toBeNull();
  });

  it("calls onOpenLeaderboard when Leaderboard button is clicked", () => {
    const onOpenLeaderboard = vi.fn();
    render(
      <ContestArenaTopbar
        title="Weekly Contest 1"
        contestId={1}
        problems={mockProblems}
        activeProblemIndex={0}
        onSelectProblem={vi.fn()}
        endTime="2026-11-10T12:00:00Z"
        serverTime="2026-11-10T10:00:00Z"
        onOpenLeaderboard={onOpenLeaderboard}
      />
    );

    const btn = screen.getByRole("button", { name: /Leaderboard/i });
    fireEvent.click(btn);
    expect(onOpenLeaderboard).toHaveBeenCalled();
  });
});

