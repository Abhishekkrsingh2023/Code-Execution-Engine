import { Badge } from "@/components/ui/badge";
import type { ContestStatus } from "@/types/contest";

interface ContestStatusBadgeProps {
  status: ContestStatus;
  className?: string;
}

export function ContestStatusBadge({ status, className }: ContestStatusBadgeProps) {
  switch (status) {
    case "live":
      return (
        <Badge
          variant="outline"
          className={`border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-medium capitalize flex items-center gap-1.5 ${
            className || ""
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Live
        </Badge>
      );
    case "upcoming":
      return (
        <Badge
          variant="outline"
          className={`border-amber-500/40 bg-amber-500/10 text-amber-400 font-medium capitalize flex items-center gap-1.5 ${
            className || ""
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Upcoming
        </Badge>
      );
    case "ended":
      return (
        <Badge
          variant="outline"
          className={`border-zinc-700 bg-zinc-800/50 text-zinc-400 font-medium capitalize flex items-center gap-1.5 ${
            className || ""
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
          Ended
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

