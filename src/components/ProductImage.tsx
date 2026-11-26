import React, { useState, useRef, useEffect } from 'react';
import {
  toDisplayImageUrl,
  buildResponsiveImageSrcSet,
  handleProxyImageError
} from '../utils/imageProxy';
import { sanitizeAltText } from '../utils/imageSeoAndDownload';

interface ProductImageProps {
  rawSrc?: string;
  alt: string;
  widths?: number[];
  defaultWidth?: number;
  sizes?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  skeletonTone?: 'dark' | 'light';
  itemProp?: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  rawSrc,
  alt,
  widths = [320, 480],
  defaultWidth = 400,
  sizes,
  width = 500,
  height = 500,
  priority = false,
  className = '',
  skeletonTone = 'dark',
  itemProp
}) => {
  const resolvedAlt = sanitizeAltText(alt);
  const resolvedSrc = toDisplayImageUrl(rawSrc || '', defaultWidth);
  const srcSet = rawSrc ? buildResponsiveImageSrcSet(rawSrc, widths) : undefined;
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [resolvedSrc]);

  return (
    <>
      {!loaded && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 animate-pulse pointer-events-none ${
            skeletonTone === 'light'
              ? 'bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200'
              : 'bg-gradient-to-br from-neutral-800 via-neutral-900 to-neutral-800'
          }`}
        />
      )}
      <img
        ref={imgRef}
        itemProp={itemProp}
        src={resolvedSrc}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={resolvedAlt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          handleProxyImageError(e);
          if (e.currentTarget.dataset.proxyFallbackStage === '2') {
            setLoaded(true);
          }
        }}
        className={`${className} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  );
};
