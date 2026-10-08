import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

interface DataTableSectionProps {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Keeps short and empty data views visually steady while allowing long tables
 * to grow. Put pagination in `footer` so it stays at the bottom of the frame.
 */
export function DataTableSection({ children, footer, className }: DataTableSectionProps) {
  return (
    <section
      className={cn(
        "flex min-h-[280px] flex-col rounded-2xl border border-slate-200 bg-white p-2 shadow-2xs md:min-h-[400px] md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none lg:min-h-[480px]",
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col [&>*]:h-full">{children}</div>
      {footer ? <div className="mt-auto shrink-0 pt-3">{footer}</div> : null}
    </section>
  );
}
