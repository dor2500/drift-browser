import { useState, useRef, useEffect, type TouchEvent, type WheelEvent } from 'react';

interface UseTabSwipeOptions {
  enabled?: boolean;
  onClose: () => void;
  threshold?: number;
}

/**
 * Hook enabling horizontal swipe gestures (left or right) to dismiss/close a tab.
 * Supports trackpad two-finger horizontal gestures and touchscreen swipes with
 * live visual sliding and smooth exit animation.
 */
export function useTabSwipe({ enabled = true, onClose, threshold = 65 }: UseTabSwipeOptions) {
  const [offsetX, setOffsetX] = useState(0);
  const [closing, setClosing] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const currentOffset = useRef(0);
  currentOffset.current = offsetX;

  const triggerClose = (dir: 'left' | 'right') => {
    if (closing) return;
    setClosing(true);
    const target = dir === 'right' ? 320 : -320;
    setOffsetX(target);
    setTimeout(() => {
      onClose();
    }, 160);
  };

  const onWheel = (e: WheelEvent) => {
    if (!enabled || closing) return;
    // Detect horizontal swipe intent (two-finger horizontal flick on trackpad)
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 2) {
      e.stopPropagation();
      if (resetTimer.current) clearTimeout(resetTimer.current);

      // On trackpad, deltaX > 0 is scroll right (fingers move left), deltaX < 0 is fingers move right
      const next = currentOffset.current - e.deltaX * 0.85;
      setOffsetX(next);

      if (Math.abs(next) >= threshold) {
        triggerClose(next > 0 ? 'right' : 'left');
        return;
      }

      resetTimer.current = setTimeout(() => {
        setOffsetX(0);
      }, 140);
    }
  };

  const onTouchStart = (e: TouchEvent) => {
    if (!enabled || closing || e.touches.length !== 1) return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!enabled || closing || !touchStart.current) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      if (e.cancelable) e.preventDefault();
      setOffsetX(dx);
    }
  };

  const onTouchEnd = () => {
    if (!enabled || closing || !touchStart.current) return;
    touchStart.current = null;
    if (Math.abs(currentOffset.current) >= threshold) {
      triggerClose(currentOffset.current > 0 ? 'right' : 'left');
    } else {
      setOffsetX(0);
    }
  };

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const isSwiping = offsetX !== 0 || closing;

  const style = isSwiping
    ? {
        transform: `translateX(${offsetX}px)`,
        opacity: Math.max(0, 1 - Math.abs(offsetX) / 160),
        boxShadow:
          offsetX > 15
            ? 'inset 3px 0 0 rgba(255, 75, 92, 0.8)'
            : offsetX < -15
              ? 'inset -3px 0 0 rgba(255, 75, 92, 0.8)'
              : undefined,
        transition: closing
          ? 'transform 0.16s cubic-bezier(0.2, 0, 0, 1), opacity 0.16s ease'
          : offsetX === 0
            ? 'transform 0.2s ease-out, opacity 0.2s ease-out'
            : 'none',
        pointerEvents: closing ? ('none' as const) : undefined,
      }
    : undefined;

  return {
    onWheel,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    style,
    isSwiping,
    closing,
  };
}
