import React from "react";

export function MeatIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18.5 7.5C16 4.5 11 4 8 7C5 10 4.5 14.5 7.5 17.5C10.5 20.5 15.5 20 18.5 17C21.5 14 21 10.5 18.5 7.5Z" />
      <ellipse cx="12" cy="12" rx="2.2" ry="1.6" />
    </svg>
  );
}

export function CarabaoIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Carabao horns spreading wide and curving */}
      <path d="M3.5 7.5C5 3.5 8 2.5 12 4C16 2.5 19 3.5 20.5 7.5C18.5 8 16.5 7.5 15.5 9" />
      <path d="M8.5 9C7.5 7.5 5.5 8 3.5 7.5" />
      <path d="M7 9C7 14 9.5 19 12 19C14.5 19 17 14 17 9" />
      <circle cx="10" cy="13.5" r="0.75" fill="currentColor" />
      <circle cx="14" cy="13.5" r="0.75" fill="currentColor" />
      <path d="M10 16.5H14" />
    </svg>
  );
}

export function CattleIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Cattle horns upright and curving */}
      <path d="M5 4.5C5 2.5 7 2 9 4.2" />
      <path d="M19 4.5C19 2.5 17 2 15 4.2" />
      <path d="M4 8C5.5 7.5 7 8 7.5 9" />
      <path d="M20 8C18.5 7.5 17 8 16.5 9" />
      <path d="M7 8L6.5 12C6.5 16 9 19 12 19C15 19 17.5 16 17.5 12L17 8" />
      <circle cx="10" cy="13.5" r="0.75" fill="currentColor" />
      <circle cx="14" cy="13.5" r="0.75" fill="currentColor" />
      <path d="M10.5 16.5C11.2 17 12.8 17 13.5 16.5" />
    </svg>
  );
}

export function HogIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12C3 7 7 5 12 5C17 5 21 7 21 12C21 17 17 19 12 19C7 19 3 17 3 12Z" />
      <ellipse cx="12" cy="12.5" rx="3.5" ry="2.3" />
      <circle cx="10.8" cy="12.5" r="0.75" fill="currentColor" />
      <circle cx="13.2" cy="12.5" r="0.75" fill="currentColor" />
      <path d="M5.5 6.5L3.5 9.5" />
      <path d="M18.5 6.5L20.5 9.5" />
    </svg>
  );
}
