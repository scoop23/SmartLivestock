"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ toastOptions, style, ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      richColors
      closeButton
      expand={false}
      duration={5000}
      visibleToasts={4}
      gap={10}
      offset={16}
      mobileOffset={16}
      className="toaster group"
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            "group/toast rounded-2xl shadow-xl border p-4 sm:p-4.5 gap-3.5 items-start max-w-[95vw] transition-all",
          title: "text-sm sm:text-[15px] font-bold tracking-tight text-slate-900",
          description:
            "text-xs sm:text-[13px] leading-relaxed text-slate-600 opacity-95 mt-1 font-normal break-words",
          actionButton:
            "rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs px-3.5 py-2 shadow-xs transition-all active:scale-95 shrink-0 whitespace-nowrap cursor-pointer",
          cancelButton:
            "rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3 py-1.5 transition-colors shrink-0",
          closeButton:
            "rounded-full bg-white/90 hover:bg-white text-slate-500 hover:text-slate-800 border border-slate-200 transition-colors shadow-2xs",
          ...toastOptions?.classNames,
        },
      }}
      style={
        {
          "--width": "440px",
          "--normal-bg": "#ffffff",
          "--normal-text": "#0f172a",
          "--normal-border": "#e2e8f0",
          "--success-bg": "#f0fdf4",
          "--success-border": "#bbf7d0",
          "--success-text": "#166534",
          "--info-bg": "#eff6ff",
          "--info-border": "#bfdbfe",
          "--info-text": "#1d4ed8",
          "--warning-bg": "#fffbeb",
          "--warning-border": "#fde68a",
          "--warning-text": "#92400e",
          "--error-bg": "#fff1f2",
          "--error-border": "#fecdd3",
          "--error-text": "#9f1239",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
