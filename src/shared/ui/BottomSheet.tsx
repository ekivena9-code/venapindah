import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from '../../constants';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    snapPoints?: number[]; // Percentage heights: [50, 75, 100]
    defaultSnap?: number; // Index of default snap point
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
    isOpen,
    onClose,
    title,
    children,
    snapPoints = [50, 90],
    defaultSnap = 0,
}) => {
    const [currentSnap, setCurrentSnap] = useState(defaultSnap);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [currentY, setCurrentY] = useState(0);
    const sheetRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        setStartY(e.touches[0].clientY);
        setCurrentY(e.touches[0].clientY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        setCurrentY(e.touches[0].clientY);
    };

    const handleTouchEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);

        const deltaY = currentY - startY;
        const threshold = 100;

        if (deltaY > threshold) {
            // Swipe down
            if (currentSnap > 0) {
                setCurrentSnap(currentSnap - 1);
            } else {
                onClose();
            }
        } else if (deltaY < -threshold) {
            // Swipe up
            if (currentSnap < snapPoints.length - 1) {
                setCurrentSnap(currentSnap + 1);
            }
        }

        setStartY(0);
        setCurrentY(0);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setStartY(e.clientY);
        setCurrentY(e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        setCurrentY(e.clientY);
    };

    const handleMouseUp = () => {
        if (!isDragging) return;
        setIsDragging(false);

        const deltaY = currentY - startY;
        const threshold = 100;

        if (deltaY > threshold) {
            if (currentSnap > 0) {
                setCurrentSnap(currentSnap - 1);
            } else {
                onClose();
            }
        } else if (deltaY < -threshold) {
            if (currentSnap < snapPoints.length - 1) {
                setCurrentSnap(currentSnap + 1);
            }
        }

        setStartY(0);
        setCurrentY(0);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, currentY, startY]);

    if (!isOpen) return null;

    const height = snapPoints[currentSnap];
    const dragOffset = isDragging ? Math.max(0, currentY - startY) : 0;

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
                onClick={onClose}
                style={{ opacity: isOpen ? 1 : 0 }}
            />

            {/* Bottom Sheet */}
            <div
                ref={sheetRef}
                className="fixed bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl shadow-2xl z-50 transition-all duration-300 ease-out"
                style={{
                    height: `${height}vh`,
                    transform: `translateY(${dragOffset}px)`,
                }}
            >
                {/* Handle */}
                <div
                    className="w-full py-3 cursor-grab active:cursor-grabbing"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={handleMouseDown}
                >
                    <div className="w-12 h-1.5 bg-brand-border rounded-full mx-auto" />
                </div>

                {/* Header */}
                {title && (
                    <div className="flex items-center justify-between gap-3 px-4 pb-3 border-b border-brand-border sm:px-6 sm:pb-4">
                        <h3 className="min-w-0 break-words text-base font-bold text-brand-text-light sm:text-lg">
                            {title}
                        </h3>
                        <button
                            onClick={onClose}
                            type="button"
                            aria-label="Tutup panel"
                            className="mobile-touch-target mobile-touch-target-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-brand-input transition-colors"
                        >
                            <XIcon className="w-5 h-5 text-brand-text-secondary" />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="overflow-y-auto h-full pb-20 px-4 pt-4 sm:px-6">
                    {children}
                </div>
            </div>
        </>,
        document.body
    );
};

export default BottomSheet;
