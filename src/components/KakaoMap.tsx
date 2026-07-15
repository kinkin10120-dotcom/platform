"use client";

export default function AddressMap({ address }: { address: string }) {
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&hl=ko`;
  return (
    <iframe
      src={src}
      className="h-56 w-full rounded-lg border-0"
      loading="lazy"
      allowFullScreen
    />
  );
}
