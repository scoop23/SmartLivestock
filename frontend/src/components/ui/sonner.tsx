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
      visibleToasts={4}
      gap={8}
      offset={16}
      mobileOffset={16}
      className="toaster group"
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast: "group/toast rounded-xl shadow-lg",
          title: "text-sm font-semibold",
          description: "text-xs leading-5 opacity-80",
          actionButton: "rounded-md bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900",
          cancelButton: "rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200",
          ...toastOptions?.classNames,
        },
      }}
      style={
        {
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
