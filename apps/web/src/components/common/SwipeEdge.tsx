import { useEffect, useRef } from 'react';

interface SwipeEdgeProps {
  onSwipeRight: () => void;
  edgeZone?: number;
  threshold?: number;
}

/**
 * Full-page swipe detector — triggers when touch starts within `edgeZone` px
 * of the left edge and swipes right beyond `threshold` px.
 * No visible element — attaches to document.
 */
export function SwipeEdge({ onSwipeRight, edgeZone = 40, threshold = 50 }: SwipeEdgeProps) {
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      const x = e.touches[0].clientX;
      if (x <= edgeZone) {
        startX.current = x;
        startY.current = e.touches[0].clientY;
        tracking.current = true;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (!tracking.current) return;
      tracking.current = false;

      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - startY.current);

      // Primarily horizontal, exceeds threshold
      if (dx > threshold && dy < dx * 0.8) {
        onSwipeRight();
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [onSwipeRight, edgeZone, threshold]);

  return null; // No DOM element
}
