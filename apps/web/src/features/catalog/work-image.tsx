import { cn } from "@/lib/cn";

/**
 * Plain <img>: sources are a mix of sample SVGs, uploaded files served by
 * /media, and (later) object-storage URLs. Switch to next/image once the
 * storage host is fixed and can be listed in images.remotePatterns.
 */
export function WorkImage({ src, alt, className }: { src: string | undefined; alt: string; className?: string }) {
  if (!src) return <div className={cn("bg-mist", className)} aria-label={alt} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}
