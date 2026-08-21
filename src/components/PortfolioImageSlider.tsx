"use client";

import { useState, useEffect } from "react";

export function PortfolioImageSlider({ images, alt }: { images: string[]; alt: string }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % images.length), 2500);
    return () => clearInterval(timer);
  }, [images.length]);

  return (
    <div className="relative w-full aspect-square bg-[#f5f5f7] overflow-hidden">
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt={images.length > 1 ? `${alt} 제품 사진 ${i + 1}` : `${alt} 제품 사진`} className={`absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0"}`}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      ))}
      {images.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1">
          {images.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`h-1 rounded-full transition-all ${i === current ? "w-4 bg-white" : "w-1 bg-white/50"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
