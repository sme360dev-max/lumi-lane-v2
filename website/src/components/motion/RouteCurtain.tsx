'use client';

import { useEffect, useState } from 'react';

let firstPaint = true;

/**
 * A cream wash that lifts off each newly routed page. It is skipped on the very first load,
 * and the stylesheet removes it entirely for reduced motion.
 */
export function RouteCurtain() {
  const [lifting] = useState(() => !firstPaint);

  useEffect(() => {
    firstPaint = false;
  }, []);

  return lifting ? <div className="route-curtain" aria-hidden="true" /> : null;
}
