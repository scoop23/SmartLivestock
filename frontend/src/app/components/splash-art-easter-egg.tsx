'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cowHead } from '@lucide/lab';
import { Icon, Sparkles, Heart } from 'lucide-react';

interface SplashArtEasterEggProps {
  isOpen: boolean;
  onClose: () => void;
}

const CREATORS = [
  'Sebasch Amauri Santillan',
  'Shantelmaxene Punzalan',
  'Alexa Villegas Sosa',
  'Mark Emmanuel Sanchez',
];

export function SplashArtEasterEgg({ isOpen, onClose }: SplashArtEasterEggProps) {
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When isOpen becomes true, initiate the enter animation
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      // Small tick to ensure browser applies initial styles before active transition classes
      const raf = requestAnimationFrame(() => {
        setIsRendered(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsRendered(false);
      setIsClosing(false);
    }
  }, [isOpen]);

  // Handle dismiss with smooth exit animation
  const handleDismiss = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsRendered(false);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 320);
  }, [isClosing, onClose]);

  // Handle keyboard Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDismiss]);

  if (!mounted) return null;
  if (!isOpen && !isClosing) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="SmartLivestock Easter Egg"
      onClick={handleDismiss}
      className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6 overflow-hidden cursor-pointer select-none transition-all duration-300 ease-out ${
        isRendered && !isClosing
          ? 'bg-black/80 backdrop-blur-xl opacity-100'
          : 'bg-black/0 backdrop-blur-none opacity-0 pointer-events-none'
      }`}
    >
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Emerald radial glow */}
        <div
          className={`absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 size-96 sm:size-[500px] rounded-full bg-emerald-500/25 blur-3xl transition-opacity duration-700 ${
            isRendered && !isClosing ? 'opacity-80 scale-100' : 'opacity-0 scale-75'
          }`}
          style={{ animation: 'aurora-1 8s ease-in-out infinite alternate' }}
        />
        {/* Golden/Warm amber radial glow */}
        <div
          className={`absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 size-80 sm:size-[450px] rounded-full bg-amber-400/20 blur-3xl transition-opacity duration-700 delay-100 ${
            isRendered && !isClosing ? 'opacity-70 scale-100' : 'opacity-0 scale-75'
          }`}
          style={{ animation: 'aurora-2 9s ease-in-out infinite alternate' }}
        />
        {/* Subtle grid mesh overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#07170c]/50 to-[#030b05]/95 opacity-90" />
      </div>

      {/* Main Splash Art Card */}
      <div
        onClick={(e) => {
          // Clicking anywhere triggers the close with animation as requested
          e.stopPropagation();
          handleDismiss();
        }}
        className={`relative z-10 w-full max-w-xl mx-auto rounded-3xl p-7 sm:p-10 text-center transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isRendered && !isClosing
            ? 'scale-100 opacity-100 translate-y-0 shadow-[0_0_90px_rgba(16,185,129,0.3),0_25px_60px_-15px_rgba(0,0,0,0.85)]'
            : 'scale-90 opacity-0 translate-y-4 shadow-none'
        } bg-gradient-to-b from-[#13351d]/90 via-[#0d2314]/90 to-[#07150c]/95 border border-emerald-500/30 backdrop-blur-2xl ring-1 ring-white/10`}
      >
        {/* Top Shimmer Border Accent */}
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

        {/* Floating Sparkle Accents */}
        <div className="absolute -top-3 right-8 pointer-events-none text-emerald-300/60 animate-pulse">
          <Sparkles className="size-6" />
        </div>
        <div className="absolute bottom-6 left-6 pointer-events-none text-amber-300/40 animate-pulse delay-300">
          <Sparkles className="size-5" />
        </div>

        {/* Central Cow Emblem */}
        <div className="flex justify-center mb-5 sm:mb-6">
          <div className="relative group">
            {/* Glow ring behind emblem */}
            <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-300 to-amber-300 opacity-60 blur-md group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />

            <div className="relative flex size-20 sm:size-24 items-center justify-center rounded-full bg-white text-[#1E4D2B] shadow-2xl ring-4 ring-emerald-400/40 transform transition-transform duration-300 group-hover:scale-105">
              <Icon iconNode={cowHead} className="size-11 sm:size-13 text-[#1E4D2B]" />
            </div>
          </div>
        </div>

        {/* Capstone System Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold tracking-widest uppercase mb-4 shadow-sm">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
          SmartLivestock · Padre Garcia
        </div>

        {/* Motto: "Dream. Create. Inspire." */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight mb-6 bg-gradient-to-r from-emerald-200 via-white to-emerald-300 bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(52,211,153,0.35)]">
          Dream. Create. Inspire.
        </h2>

        {/* Decorative Divider */}
        <div className="flex items-center justify-center gap-3 my-5 sm:my-6 opacity-70">
          <div className="h-px w-16 sm:w-24 bg-gradient-to-r from-transparent to-emerald-400/60" />
          <div className="size-1.5 rounded-full bg-emerald-400" />
          <div className="h-px w-16 sm:w-24 bg-gradient-to-l from-transparent to-emerald-400/60" />
        </div>

        {/* Creators / Names Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 max-w-lg mx-auto">
          {CREATORS.map((name) => (
            <div
              key={name}
              className="group relative px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-emerald-400/40 backdrop-blur-md text-white font-medium text-xs sm:text-sm tracking-wide transition-all duration-200 shadow-sm flex items-center justify-center"
            >
              <span className="truncate">{name}</span>
            </div>
          ))}
        </div>

        {/* "made with love" with low opacity and low size */}
        <div className="mt-7 flex items-center justify-center gap-1.5 text-xs text-white/35 font-light tracking-wider lowercase select-none">
          <span>made with love</span>
          <Heart className="size-3 text-rose-400/45 fill-rose-400/35 inline-block shrink-0" />
        </div>

        {/* Dismiss hint */}
        <p className="mt-3 text-[11px] text-white/20 tracking-wider">
          (click anywhere to close)
        </p>
      </div>
    </div>,
    document.body
  );
}
