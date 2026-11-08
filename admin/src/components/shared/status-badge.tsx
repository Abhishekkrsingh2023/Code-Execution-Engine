import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  type: "role" | "user_status" | "problem_status" | "difficulty" | "audit_status";
  value: string | null | undefined;
}

export function StatusBadge({ type, value }: StatusBadgeProps) {
  if (!value) return <span className="text-zinc-400 text-xs">—</span>;

  const normalized = value.toLowerCase();

  switch (type) {
    case "role": {
      if (normalized === "admin") return <Badge variant="default">Admin</Badge>;
      if (normalized === "moderator") return <Badge variant="info">Moderator</Badge>;
      return <Badge variant="secondary">User</Badge>;
    }
    case "user_status": {
      if (normalized === "active") return <Badge variant="success">Active</Badge>;
      if (normalized === "inactive") return <Badge variant="secondary">Inactive</Badge>;
      if (normalized === "suspended") return <Badge variant="danger">Suspended</Badge>;
      return <Badge variant="outline">{value}</Badge>;
    }
    case "problem_status": {
      if (normalized === "published") return <Badge variant="success">Published</Badge>;
      if (normalized === "draft") return <Badge variant="secondary">Draft</Badge>;
      if (normalized === "unpublished") return <Badge variant="warning">Unpublished</Badge>;
      if (normalized === "archived") return <Badge variant="danger">Archived</Badge>;
      return <Badge variant="outline">{value}</Badge>;
    }
    case "difficulty": {
      if (normalized === "easy") return <Badge variant="success">Easy</Badge>;
      if (normalized === "medium") return <Badge variant="warning">Medium</Badge>;
      if (normalized === "hard") return <Badge variant="danger">Hard</Badge>;
      return <Badge variant="outline">{value}</Badge>;
    }
    case "audit_status": {
      if (normalized === "success") return <Badge variant="success">Success</Badge>;
      if (normalized === "failure") return <Badge variant="warning">Failure</Badge>;
      if (normalized === "error") return <Badge variant="danger">Error</Badge>;
      return <Badge variant="outline">{value}</Badge>;
    }
    default:
      return <Badge variant="outline">{value}</Badge>;
  }
}

