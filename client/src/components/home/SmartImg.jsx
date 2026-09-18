import { useState } from 'react';

/**
 * <img> that swaps to `fallback` when the file is missing, so the landing
 * page still looks finished before the /public/assets images are copied in.
 */
export default function SmartImg({ src, alt = '', fallback = null, ...rest }) {
  const [failed, setFailed] = useState(!src);
  if (failed) return fallback;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
