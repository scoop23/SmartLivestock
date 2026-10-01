"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

export function ActivityPhotoCarousel({
  photos,
  alt,
  variant = "card",
}: {
  photos: string[];
  alt: string;
  variant?: "card" | "dialog";
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const isDialog = variant === "dialog";

  useEffect(() => {
    if (!api) return;
    const updateIndex = () => setActiveIndex(api.selectedScrollSnap());
    updateIndex();
    api.on("select", updateIndex);
    api.on("reInit", updateIndex);
    return () => {
      api.off("select", updateIndex);
      api.off("reInit", updateIndex);
    };
  }, [api]);

  if (photos.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400">
        <ImageIcon className={isDialog ? "size-10" : "size-8"} aria-hidden="true" />
        <span className="text-[11px] font-medium text-slate-400">No photos attached</span>
      </div>
    );
  }

  const arrowBase = "absolute top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/60 bg-white/85 text-slate-800 shadow-md backdrop-blur-sm transition hover:bg-white";
  const prevArrowClass = isDialog
    ? `${arrowBase} left-2.5 sm:left-4 size-8 sm:size-10`
    : `${arrowBase} left-2.5 size-8 sm:left-3 sm:size-9`;
  const nextArrowClass = isDialog
    ? `${arrowBase} right-2.5 sm:right-4 size-8 sm:size-10`
    : `${arrowBase} right-2.5 size-8 sm:right-3 sm:size-9`;

  return (
    <div className="relative h-full w-full">
      <Carousel
        opts={{ loop: photos.length > 1, align: "start" }}
        setApi={setApi}
        aria-label={`${alt} photos`}
        className="h-full"
      >
        <CarouselContent className="ml-0 h-full">
          {photos.map((photo, index) => (
            <CarouselItem key={`${photo}-${index}`} className="h-full pl-0">
              <img
                src={photo}
                alt={`${alt}, photo ${index + 1} of ${photos.length}`}
                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </CarouselItem>
          ))}
        </CarouselContent>

        {photos.length > 1 ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous photo"
              onClick={(event) => {
                event.stopPropagation();
                api?.scrollPrev();
              }}
              className={prevArrowClass}
            >
              <ChevronLeft className="size-4 sm:size-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next photo"
              onClick={(event) => {
                event.stopPropagation();
                api?.scrollNext();
              }}
              className={nextArrowClass}
            >
              <ChevronRight className="size-4 sm:size-5" />
            </Button>

            <div className="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-1.5 px-14">
              {photos.map((photo, index) => (
                <button
                  key={`${photo}-dot-${index}`}
                  type="button"
                  aria-label={`Show photo ${index + 1}`}
                  aria-pressed={index === activeIndex}
                  onClick={(event) => {
                    event.stopPropagation();
                    api?.scrollTo(index);
                  }}
                  className={`rounded-full border border-white/80 shadow-sm transition-all ${index === activeIndex ? "h-2 w-5 bg-white" : "h-2 w-2 bg-white/55 hover:bg-white/85"}`}
                />
              ))}
            </div>

            <span
              aria-live="polite"
              className={`absolute bottom-3 z-20 rounded-full bg-slate-900/55 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white backdrop-blur-sm ${isDialog ? "right-4" : "right-2.5 sm:right-3"}`}
            >
              {activeIndex + 1}/{photos.length}
            </span>
          </>
        ) : null}
      </Carousel>
    </div>
  );
}
