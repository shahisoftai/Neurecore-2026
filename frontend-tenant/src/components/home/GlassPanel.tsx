'use client';

import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface GlassPanelProps {
    children: React.ReactNode;
    className?: string;
    variant?: 'primary' | 'secondary' | 'icon';
    animated?: boolean;
    delay?: number;
    onClick?: () => void;
}

export function GlassPanel({
    children,
    className,
    variant = 'primary',
    animated = true,
    delay = 0,
    onClick,
}: GlassPanelProps) {
    const baseClasses = clsx(
        'backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl',
        'hover:bg-white/10 hover:border-white/20 transition-all duration-300',
        'hover:shadow-2xl',
        onClick && 'cursor-pointer',
        className
    );

    if (!animated) {
        return (
            <div className={baseClasses} onClick={onClick}>
                {children}
            </div>
        );
    }

    return (
        <motion.div
            className={baseClasses}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            onClick={onClick}
        >
            {children}
        </motion.div>
    );
}
