"use client";

import React, { useState, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type SheetSnapState = "collapsed" | "half" | "expanded";

const getSnapPoints = (viewportHeight: number) => [
  { state: "collapsed" as const, height: 116 },
  { state: "half" as const, height: Math.round(viewportHeight * 0.54) },
  { state: "expanded" as const, height: Math.round(viewportHeight * 0.89) },
];

const getSnapPointHeight = (state: SheetSnapState, viewportHeight: number) =>
  getSnapPoints(viewportHeight).find((point) => point.state === state)?.height ??
  Math.round(viewportHeight * 0.54);

const clampPanelHeight = (height: number, viewportHeight: number) =>
  Math.max(116, Math.min(Math.round(viewportHeight * 0.89), height));

const getNearestSnapState = (height: number, viewportHeight: number): SheetSnapState =>
  getSnapPoints(viewportHeight).reduce((nearest, point) =>
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

  // Pointer events keep touch and mouse gestures on the handle consistent.
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    pointerStartY.current = e.clientY;
    pointerStartHeight.current =
      panelRef.current?.getBoundingClientRect().height ??
      getSnapPointHeight(snapState, window.innerHeight);
    setDragHeight(pointerStartHeight.current);
    pointerDeltaY.current = 0;
    didDrag.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartY.current === null) return;
    pointerDeltaY.current = e.clientY - pointerStartY.current;
    if (Math.abs(pointerDeltaY.current) > 8) didDrag.current = true;
    setDragHeight(
      clampPanelHeight(
        pointerStartHeight.current - pointerDeltaY.current,
        window.innerHeight
      )
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartY.current === null) return;
    const finalHeight = clampPanelHeight(
      pointerStartHeight.current - pointerDeltaY.current,
      window.innerHeight
    );
    setSnapState(getNearestSnapState(finalHeight, window.innerHeight));
    setDragHeight(null);

    if (didDrag.current) suppressClickUntil.current = Date.now() + 400;
    pointerStartY.current = null;
    pointerDeltaY.current = 0;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handlePointerCancel = () => {
    if (pointerStartY.current !== null) {
      const finalHeight = clampPanelHeight(
        pointerStartHeight.current - pointerDeltaY.current,
        window.innerHeight
      );
      setSnapState(getNearestSnapState(finalHeight, window.innerHeight));
    }
    setDragHeight(null);
    pointerStartY.current = null;
    pointerDeltaY.current = 0;
    didDrag.current = false;
  };

  // Click on the grab handle area to cycle or toggle
  const toggleSnapState = () => {
    setSnapState((current) => {
      if (current === "collapsed") return "half";
      if (current === "half") return "expanded";
      return "collapsed";
    });
  };

  // Mobile height styles based on snap state
  const mobileHeightClass = (() => {
    switch (snapState) {
      case "collapsed":
        return "h-[116px]";
      case "half":
        return "h-[54vh]";
      case "expanded":
        return "h-[89vh]";
    }
  })();

  return (
    <div
      ref={panelRef}
      style={dragHeight === null ? undefined : { height: `${dragHeight}px` }}
      className={`w-full ${dragHeight === null ? "transition-all duration-300 ease-out" : "transition-none"} flex flex-col fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-slate-800 rounded-t-[32px] shadow-[0_-12px_40px_rgba(0,0,0,0.22)] ${mobileHeightClass} lg:static lg:h-auto lg:max-h-none lg:border-0 lg:shadow-none lg:bg-transparent lg:backdrop-blur-none lg:rounded-none lg:z-auto lg:p-0`}
    >
      {/* ── DRAG HANDLE & HEADER (Visible only on mobile/tablet) ── */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={() => {
          if (Date.now() < suppressClickUntil.current) return;
          toggleSnapState();
        }}
        className="w-full touch-none overscroll-y-contain pt-2.5 pb-2 px-4 flex flex-col items-center cursor-grab active:cursor-grabbing select-none shrink-0 group border-b border-slate-100 dark:border-slate-800 lg:hidden"
      >
        {/* Grab Handle: visual cue letting user know panel is interactive */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-emerald-600 transition-colors" />

        <div className="w-full flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge className="bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 shrink-0">
              {activeTabMeta.icon}
              <span className="truncate">{activeTabMeta.label}</span>
            </Badge>
            <span className="text-[11px] text-slate-500 truncate">
              {snapState === "collapsed" ? "Swipe up to view" : snapState === "half" ? "Half-view active" : "Full-view active"}
            </span>
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              {snapState === "collapsed" ? "Drag up" : snapState === "expanded" ? "Drag down" : "Drag handle"}
            </span>
            {snapState === "expanded" ? (
              <ChevronDown className="size-4 text-slate-600" />
            ) : (
              <ChevronUp className="size-4 text-slate-600" />
            )}
          </div>
        </div>
      </div>

      {/* ── QUICK TAB SWITCHER BAR (Mobile view) ── */}
      <div className="px-3 py-2 overflow-x-auto no-scrollbar shrink-0 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-900/60 flex items-center gap-1.5 lg:hidden">
        {tabItems.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectTab(tab.id);
                if (snapState === "collapsed") setSnapState("half");
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                isActive
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`size-4 rounded-full text-[9px] flex items-center justify-center font-black ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
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
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 overscroll-contain lg:overflow-visible lg:p-0 lg:flex-none">
        {children}
      </div>
    </div>
  );
}
