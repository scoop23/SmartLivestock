"use client";

import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useRef, useState, type PointerEvent, type KeyboardEvent } from "react";

export type SheetSnapState = "collapsed" | "half" | "expanded";

const mobileSnapPoints = (viewportHeight: number) => [
  { state: "collapsed" as const, height: 116 },
  { state: "half" as const, height: Math.round(viewportHeight * 0.54) },
  { state: "expanded" as const, height: Math.round(viewportHeight * 0.89) },
];

const clampMobileHeight = (height: number, viewportHeight: number) =>
  Math.max(116, Math.min(Math.round(viewportHeight * 0.89), height));

const nearestMobileSnap = (height: number, viewportHeight: number): SheetSnapState =>
  mobileSnapPoints(viewportHeight).reduce((nearest, point) =>
    Math.abs(point.height - height) < Math.abs(nearest.height - height) ? point : nearest
  ).state;

interface LivestockSlidingPanelProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  tabItems: Array<{
    id: string;
    label: string;
    count?: number;
    icon: React.ReactNode;
  }>;
  children: React.ReactNode;
}

export function LivestockSlidingPanel({
  activeTab,
  onSelectTab,
  tabItems,
  children,
}: LivestockSlidingPanelProps) {
  const [snapState, setSnapState] = useState<SheetSnapState>("half");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pointerStartY = useRef<number | null>(null);
  const pointerStartHeight = useRef<number>(0);
  const pointerDeltaY = useRef<number>(0);
  const didDrag = useRef<boolean>(false);
  const suppressClickUntil = useRef<number>(0);

  const activeTabMeta = tabItems.find((t) => t.id === activeTab) || tabItems[0];

  // Drag gestures modeled directly after GISSidebar for reliable touch and pointer response
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointerStartY.current = event.clientY;
    pointerStartHeight.current =
      panelRef.current?.getBoundingClientRect().height ??
      Math.round(window.innerHeight * 0.54);
    pointerDeltaY.current = 0;
    didDrag.current = false;
    setDragHeight(pointerStartHeight.current);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported in environment
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerStartY.current === null) return;
    pointerDeltaY.current = event.clientY - pointerStartY.current;
    if (Math.abs(pointerDeltaY.current) > 8) didDrag.current = true;
    setDragHeight(
      clampMobileHeight(
        pointerStartHeight.current - pointerDeltaY.current,
        window.innerHeight
      )
    );
  };

  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerStartY.current === null) return;
    const height = clampMobileHeight(
      pointerStartHeight.current - pointerDeltaY.current,
      window.innerHeight
    );
    setSnapState(nearestMobileSnap(height, window.innerHeight));
    setDragHeight(null);
    if (didDrag.current) suppressClickUntil.current = Date.now() + 400;
    pointerStartY.current = null;
    pointerDeltaY.current = 0;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore
    }
  };

  const handlePointerCancel = () => {
    if (pointerStartY.current !== null) {
      const height = clampMobileHeight(
        pointerStartHeight.current - pointerDeltaY.current,
        window.innerHeight
      );
      setSnapState(nearestMobileSnap(height, window.innerHeight));
    }
    setDragHeight(null);
    pointerStartY.current = null;
    pointerDeltaY.current = 0;
    didDrag.current = false;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const states: SheetSnapState[] = ["collapsed", "half", "expanded"];
    const currentIndex = states.indexOf(snapState);
    if (event.key === "ArrowUp") setSnapState(states[Math.min(states.length - 1, currentIndex + 1)]);
    else if (event.key === "ArrowDown") setSnapState(states[Math.max(0, currentIndex - 1)]);
    else if (event.key === "Home") setSnapState("collapsed");
    else if (event.key === "End") setSnapState("expanded");
    else return;
    event.preventDefault();
  };

  const toggleSnapState = () => {
    setSnapState((current) => {
      if (current === "collapsed") return "half";
      if (current === "half") return "expanded";
      return "collapsed";
    });
  };

  const mobileHeightClass =
    snapState === "collapsed"
      ? "h-[116px]"
      : snapState === "half"
        ? "h-[54dvh]"
        : "h-[89dvh]";

  return (
    <div
      ref={panelRef}
      style={dragHeight === null ? undefined : { height: `${dragHeight}px` }}
      className={`w-full ${mobileHeightClass} max-h-[89dvh] flex flex-col fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 rounded-t-3xl shadow-[0_-8px_30px_rgba(15,23,42,0.12)] overflow-hidden transition-[height] duration-300 ${dragHeight === null ? "" : "!transition-none"} lg:static lg:h-auto lg:max-h-none lg:border-0 lg:shadow-none lg:bg-transparent lg:!bg-transparent lg:rounded-none lg:z-auto lg:p-0 lg:overflow-visible`}
    >
      {/* ── DRAG HANDLE & HEADER (Visible only on mobile/tablet) ── */}
      <div className="shrink-0 lg:hidden">
        <button
          type="button"
          aria-label={`Livestock profile tabs panel is ${snapState}. Use arrow keys to resize or drag the handle.`}
          aria-expanded={snapState !== "collapsed"}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={handlePointerCancel}
          onKeyDown={handleKeyDown}
          onClick={() => {
            if (Date.now() < suppressClickUntil.current) return;
            toggleSnapState();
          }}
          className="group flex w-full shrink-0 touch-none flex-col items-center border-b border-slate-100 bg-white px-4 pb-2.5 pt-2.5 text-left outline-none cursor-grab active:cursor-grabbing select-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
        >
          {/* Grab Handle: visual pill cue letting user know panel is interactive */}
          <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-slate-300 transition-colors group-hover:bg-emerald-600 group-active:bg-emerald-700" />

          <div className="mt-2 flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Badge className="bg-emerald-700 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 shrink-0 shadow-2xs">
                {activeTabMeta.icon}
                <span className="truncate">{activeTabMeta.label}</span>
              </Badge>
              <span className="text-[11px] text-slate-500 truncate">
                {snapState === "collapsed" ? "Swipe up to view" : snapState === "half" ? "Half-view active" : "Full-view active"}
              </span>
            </div>

            <div className="flex items-center gap-1 text-slate-500 shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                {snapState === "collapsed" ? "Swipe up to expand" : snapState === "expanded" ? "Swipe down to close" : "Drag to resize"}
              </span>
              {snapState === "expanded" ? (
                <ChevronDown className="size-4 text-slate-500 transition-transform group-hover:translate-y-0.5" />
              ) : (
                <ChevronUp className="size-4 text-slate-500 transition-transform group-hover:-translate-y-0.5" />
              )}
            </div>
          </div>
        </button>
      </div>

      {/* ── QUICK TAB SWITCHER BAR (Mobile view) ── */}
      <div
        data-tour="profile-tabs-mobile"
        className="px-3 py-2 overflow-x-auto no-scrollbar shrink-0 border-b border-slate-200/80 bg-slate-50/90 flex items-center gap-1.5 lg:hidden"
      >
        {tabItems.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              data-tour={tab.id === "pedigree" ? "profile-pedigree-tab-mobile" : undefined}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTab(tab.id);
                if (snapState === "collapsed") setSnapState("half");
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                isActive
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-100/80 active:bg-slate-200/80"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`size-4 rounded-full text-[9px] flex items-center justify-center font-black ${
                    isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-700 border border-slate-200/60"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT BODY ── */}
      <div
        className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 overscroll-contain bg-white text-slate-900 ${
          snapState === "collapsed" && (dragHeight ?? 0) < 150 ? "hidden" : ""
        } lg:overflow-visible lg:p-0 lg:flex-none lg:bg-transparent`}
      >
        {children}
      </div>
    </div>
  );
}
