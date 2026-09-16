import * as React from "react";
import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {}

function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "animate-spin rounded-full border-b-2 border-emerald-600",
        !className?.includes("h-") && !className?.includes("size-") && "h-8 w-8",
        className
      )}
      {...props}
    />
  );
}

export { Spinner };
