import React, { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

export const FileEye = forwardRef<SVGSVGElement, LucideProps>(
  ({ className = "size-4", size = 24, strokeWidth = 2, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        <path d="M20 13V8l-6-6H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4" />
        <path d="M14 2v6h6" />
        <path d="M8 11h7" />
        <path d="M8 15h3" />
        <path d="M10.5 18c1.3-3.2 3.8-4.5 6.5-4.5s5.2 1.3 6.5 4.5c-1.3 3.2-3.8 4.5-6.5 4.5s-5.2-1.3-6.5-4.5Z" />
        <circle cx="17" cy="18" r="1.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }
);

FileEye.displayName = "FileEye";

export default FileEye;
