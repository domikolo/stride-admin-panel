'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

interface PageTransitionProps {
    children: React.ReactNode;
}

/**
 * Animates page content on route change WITHOUT remounting children.
 * Uses CSS animation triggered by pathname change instead of key-based remount.
 */
export default function PageTransition({ children }: PageTransitionProps) {
    const pathname = usePathname();
    const ref = useRef<HTMLDivElement>(null);
    const prevPathname = useRef(pathname);

    useEffect(() => {
        if (pathname !== prevPathname.current && ref.current) {
            prevPathname.current = pathname;
            // Trigger CSS animation
            ref.current.style.animation = 'none';
            // Force reflow to restart animation
            ref.current.offsetHeight;
            ref.current.style.animation = 'pageIn 0.2s ease-out';
        }
    }, [pathname]);

    return (
        <div ref={ref} style={{ animation: 'pageIn 0.2s ease-out' }}>
            {children}
        </div>
    );
}
