"use client";

import { useState, type ImgHTMLAttributes } from "react";

const FALLBACK_COVER = "/landing/boutique-hero.jpg";

type CoverImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
};

/** Hero / à-propos cover with fallback when the asset is missing or tiny (e.g. 1×1). */
export function CoverImage({ src, alt = "", onLoad, onError, ...rest }: CoverImageProps) {
  const [current, setCurrent] = useState(src?.trim() || FALLBACK_COVER);

  return (
    <img
      {...rest}
      alt={alt}
      src={current}
      onLoad={(event) => {
        const image = event.currentTarget;
        if (
          current !== FALLBACK_COVER &&
          (image.naturalWidth < 48 || image.naturalHeight < 48)
        ) {
          setCurrent(FALLBACK_COVER);
        }
        onLoad?.(event);
      }}
      onError={(event) => {
        if (current !== FALLBACK_COVER) setCurrent(FALLBACK_COVER);
        onError?.(event);
      }}
    />
  );
}
