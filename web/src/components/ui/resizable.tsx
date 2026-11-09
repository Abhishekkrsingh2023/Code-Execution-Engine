"use client";

import * as React from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";
import { GripVertical, GripHorizontal } from "lucide-react";

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof PanelGroup>) => (
  <PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
);

const ResizablePanel = Panel;

const ResizableHandle = ({
  withHandle = true,
  className,
  ...props
}: React.ComponentProps<typeof PanelResizeHandle> & {
  withHandle?: boolean;
}) => (
  <PanelResizeHandle
    className={cn(
      "group relative flex items-center justify-center bg-[var(--border)] transition-colors hover:bg-[var(--brand)] active:bg-[var(--brand)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] select-none",
      // Horizontal handle (separating left and right panels)
      "w-1.5 cursor-col-resize",
      // Vertical handle (separating top editor and bottom test cases)
      "data-[panel-group-direction=vertical]:h-1.5 data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:cursor-row-resize",
      className
    )}
    hitAreaMargins={{ coarse: 15, fine: 10 }}
    {...props}
  >
    {withHandle && (
      <>
        {/* Horizontal divider handle icon (shown when direction is vertical) */}
        <div className="z-20 hidden group-data-[panel-group-direction=vertical]:flex h-3 w-8 items-center justify-center rounded-xs border border-[var(--border)] bg-[var(--card)] shadow-xs hover:border-[var(--brand)]">
          <GripHorizontal className="h-2 w-4 text-[var(--muted-foreground)]" />
        </div>
        {/* Vertical divider handle icon (shown when direction is horizontal) */}
        <div className="z-20 flex group-data-[panel-group-direction=vertical]:hidden h-8 w-3 items-center justify-center rounded-xs border border-[var(--border)] bg-[var(--card)] shadow-xs hover:border-[var(--brand)]">
          <GripVertical className="h-4 w-2 text-[var(--muted-foreground)]" />
        </div>
      </>
    )}
  </PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
