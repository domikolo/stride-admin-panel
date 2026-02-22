/**
 * TypewriterText — animuje tekst generowany przez AI znak po znaku.
 * Przy każdej zmianie `text` animacja startuje od zera.
 */

'use client';

import { useEffect, useState, useRef } from 'react';

interface TypewriterTextProps {
    text: string;
    speed?: number; // ms per character, default 15
    className?: string;
}

export default function TypewriterText({ text, speed = 15, className }: TypewriterTextProps) {
    const [displayed, setDisplayed] = useState('');
    const indexRef = useRef(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!text) {
            setDisplayed('');
            return;
        }

        // Reset on text change
        setDisplayed('');
        indexRef.current = 0;

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
            indexRef.current += 1;
            setDisplayed(text.slice(0, indexRef.current));

            if (indexRef.current >= text.length) {
                clearInterval(intervalRef.current!);
                intervalRef.current = null;
            }
        }, speed);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [text, speed]);

    if (!text) return null;

    return <span className={className}>{displayed}</span>;
}
