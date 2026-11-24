interface ResponsivePictureProps {
  /** Base name in /public/assets/img, e.g. "coffee". */
  name: string;
  widths: readonly number[];
  sizes: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
}

const src = (name: string, w: number, ext: 'avif' | 'webp') => `/assets/img/${name}-${w}.${ext}`;
const srcSet = (name: string, widths: readonly number[], ext: 'avif' | 'webp') =>
  widths.map((w) => `${src(name, w, ext)} ${w}w`).join(', ');

/** AVIF + WebP <picture> with width/height set so the layout never shifts. */
export function ResponsivePicture({
  name,
  widths,
  sizes,
  alt,
  width,
  height,
  className,
  priority,
  fetchPriority,
}: ResponsivePictureProps) {
  const fallback = widths[Math.min(1, widths.length - 1)] ?? widths[0] ?? 800;
  return (
    <picture>
      <source type="image/avif" srcSet={srcSet(name, widths, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(name, widths, 'webp')} sizes={sizes} />
      <img
        src={src(name, fallback, 'webp')}
        width={width}
        height={height}
        alt={alt}
        className={className}
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={fetchPriority}
      />
    </picture>
  );
}
