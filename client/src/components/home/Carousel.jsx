import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Picks the slides-per-view of the largest breakpoint <= window width. */
function useSlidesPerView(breakpoints) {
  const pick = useCallback(() => {
    const w = typeof window === 'undefined' ? 1200 : window.innerWidth;
    let value = 1;
    Object.keys(breakpoints)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((bp) => {
        if (w >= bp) value = breakpoints[bp];
      });
    return value;
  }, [breakpoints]);

  const [spv, setSpv] = useState(pick);
  useEffect(() => {
    const onResize = () => setSpv(pick());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pick]);
  return spv;
}

/**
 * Lightweight replacement for the Swiper carousels used on the original site:
 * responsive slides-per-view, looping autoplay (paused on hover), arrows,
 * dots and touch swipe.
 */
export default function Carousel({
  items,
  renderItem,
  breakpoints = { 0: 1 },
  gap = 16,
  autoplay = 0,
  arrows = false,
  dots = false,
  label = 'Carousel',
  className = '',
}) {
  const spv = useSlidesPerView(breakpoints);
  const maxIndex = Math.max(0, Math.ceil(items.length - spv));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);

  const current = Math.min(index, maxIndex);
  const offset = Math.min(current, Math.max(0, items.length - spv));

  const go = useCallback(
    (delta) =>
      setIndex((i) => {
        const next = Math.min(i, maxIndex) + delta;
        if (next > maxIndex) return 0;
        if (next < 0) return maxIndex;
        return next;
      }),
    [maxIndex]
  );

  useEffect(() => {
    if (!autoplay || paused || maxIndex === 0) return undefined;
    const t = setInterval(() => go(1), autoplay);
    return () => clearInterval(t);
  }, [autoplay, paused, go, maxIndex]);

  const slideW = `calc((100% - ${gap * (spv - 1)}px) / ${spv})`;

  return (
    <div
      className={`aa-carousel ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="aa-carousel__viewport">
        <div
          className="aa-carousel__track"
          style={{
            gap: `${gap}px`,
            transform: `translateX(calc(-${offset} * (${slideW} + ${gap}px)))`,
          }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              className="aa-carousel__slide"
              style={{ flex: `0 0 ${slideW}` }}
              aria-hidden={i < offset || i >= offset + spv}
            >
              {renderItem(item, i)}
            </div>
          ))}
        </div>
      </div>

      {arrows && maxIndex > 0 && (
        <>
          <button type="button" className="aa-carousel__arrow is-prev" onClick={() => go(-1)} aria-label="Previous slide">
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <button type="button" className="aa-carousel__arrow is-next" onClick={() => go(1)} aria-label="Next slide">
            <ChevronRight size={22} strokeWidth={2.5} />
          </button>
        </>
      )}

      {dots && maxIndex > 0 && (
        <div className="aa-carousel__dots">
          {Array.from({ length: maxIndex + 1 }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`aa-carousel__dot ${i === current ? 'is-active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
