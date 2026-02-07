import React, { useState, useEffect } from 'react';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

// Check-in type matching iOS BodyWeight model
interface BodyWeightCheckin {
    id: string;
    oldWeight: number;
    newWeight: number;
    frontUrl?: string;
    backUrl?: string;
    sideUrl?: string;
    createdAt: number;
    updatedAt: number;
}

type PhotoType = 'front' | 'side' | 'back';

interface CheckinDetailModalProps {
    checkin: BodyWeightCheckin;
    isOpen: boolean;
    onClose: () => void;
    username?: string;
}

const CheckinDetailModal: React.FC<CheckinDetailModalProps> = ({
    checkin,
    isOpen,
    onClose,
    username
}) => {
    const [selectedPhotoType, setSelectedPhotoType] = useState<PhotoType>('front');
    const [imageLoading, setImageLoading] = useState(true);

    // Calculate weight change
    const weightChange = checkin.newWeight - checkin.oldWeight;
    const hasChange = Math.abs(weightChange) > 0.1;
    const isGain = weightChange > 0;

    // Check which photos are available
    const hasPhotos = checkin.frontUrl || checkin.backUrl || checkin.sideUrl;
    const availablePhotos: PhotoType[] = [];
    if (checkin.frontUrl) availablePhotos.push('front');
    if (checkin.sideUrl) availablePhotos.push('side');
    if (checkin.backUrl) availablePhotos.push('back');

    // Get current photo URL
    const getCurrentPhotoUrl = (): string | undefined => {
        switch (selectedPhotoType) {
            case 'front': return checkin.frontUrl;
            case 'side': return checkin.sideUrl;
            case 'back': return checkin.backUrl;
        }
    };

    // Cycle through photo types
    const cyclePhoto = (backward: boolean) => {
        if (availablePhotos.length <= 1) return;

        const currentIndex = availablePhotos.indexOf(selectedPhotoType);
        if (currentIndex === -1) {
            setSelectedPhotoType(availablePhotos[0]);
            return;
        }

        if (backward) {
            const newIndex = (currentIndex - 1 + availablePhotos.length) % availablePhotos.length;
            setSelectedPhotoType(availablePhotos[newIndex]);
        } else {
            const newIndex = (currentIndex + 1) % availablePhotos.length;
            setSelectedPhotoType(availablePhotos[newIndex]);
        }
    };

    // Auto-select first available photo if current is not available
    useEffect(() => {
        if (!getCurrentPhotoUrl() && availablePhotos.length > 0) {
            setSelectedPhotoType(availablePhotos[0]);
        }
    }, [checkin, selectedPhotoType, availablePhotos]);

    // Reset loading state when photo changes
    useEffect(() => {
        setImageLoading(true);
    }, [selectedPhotoType]);

    // Format date
    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const currentPhotoUrl = getCurrentPhotoUrl();

    return (
        <>
            <style>{`
                @keyframes checkinFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes checkinSlideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .checkin-modal-backdrop { animation: checkinFadeIn 0.2s ease-out forwards; }
                .checkin-modal-content { animation: checkinSlideUp 0.3s ease-out forwards; }
            `}</style>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 checkin-modal-backdrop"
                onClick={handleBackdropClick}
            >
                <div className="bg-zinc-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-zinc-700 shadow-2xl checkin-modal-content">
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
                            aria-label="Close"
                        >
                            <XMarkIcon className="w-5 h-5 text-white" />
                        </button>

                        <h2 className="text-lg font-bold text-white">Weigh-in Details</h2>

                        {/* Placeholder for balance */}
                        <div className="w-9 h-9" />
                    </div>

                    <div className="p-5 space-y-6">
                        {/* User Info (if available) */}
                        {username && (
                            <div className="flex items-center justify-center">
                                <span className="text-sm font-medium text-zinc-400">
                                    {username}'s Weigh-in
                                </span>
                            </div>
                        )}

                        {/* Stats Card */}
                        <div className="bg-zinc-800/50 rounded-xl overflow-hidden border border-[#E0FE10]/20">
                            {/* Date Row */}
                            <div className="px-5 py-4 border-b border-zinc-700/50">
                                <p className="text-xs font-semibold text-zinc-500 tracking-wider uppercase mb-1">
                                    Date
                                </p>
                                <p className="text-lg font-semibold text-white">
                                    {formatDate(checkin.createdAt)}
                                </p>
                            </div>

                            {/* Weight Row */}
                            <div className="px-5 py-4 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-zinc-500 tracking-wider uppercase mb-1">
                                        Weight
                                    </p>
                                    <p className="text-3xl font-bold text-white">
                                        {checkin.newWeight.toFixed(1)} <span className="text-base text-zinc-500">lbs</span>
                                    </p>
                                </div>

                                {/* Weight Change */}
                                {hasChange && (
                                    <div className="text-right">
                                        <p className="text-xs font-semibold text-zinc-500 tracking-wider uppercase mb-1">
                                            Change
                                        </p>
                                        <div className={`flex items-center gap-2 text-lg font-semibold ${isGain ? 'text-orange-400' : 'text-green-400'
                                            }`}>
                                            <svg
                                                className={`w-4 h-4 ${isGain ? '' : 'rotate-180'}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M7 17l5-5 5 5"
                                                />
                                            </svg>
                                            <span>
                                                {isGain ? '+' : ''}{weightChange.toFixed(1)} lbs
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Progress Photos Section */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-semibold text-zinc-500 tracking-wider uppercase px-1">
                                Progress Photos
                            </h3>

                            {hasPhotos ? (
                                <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/30 space-y-4">
                                    {/* Main Image Viewer */}
                                    <div className="relative aspect-[3/4] bg-zinc-900 rounded-xl overflow-hidden">
                                        {currentPhotoUrl ? (
                                            <>
                                                {imageLoading && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E0FE10]"></div>
                                                    </div>
                                                )}
                                                <img
                                                    src={currentPhotoUrl}
                                                    alt={`${selectedPhotoType} progress photo`}
                                                    className={`w-full h-full object-contain transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'
                                                        }`}
                                                    onLoad={() => setImageLoading(false)}
                                                    onError={() => setImageLoading(false)}
                                                />

                                                {/* Navigation Arrows */}
                                                {availablePhotos.length > 1 && (
                                                    <>
                                                        <button
                                                            onClick={() => cyclePhoto(true)}
                                                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white transition-colors"
                                                            aria-label="Previous photo"
                                                        >
                                                            <ChevronLeftIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => cyclePhoto(false)}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white transition-colors"
                                                            aria-label="Next photo"
                                                        >
                                                            <ChevronRightIcon className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500">
                                                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <p className="text-sm">No {selectedPhotoType} photo</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Thumbnails */}
                                    <div className="flex justify-center gap-3">
                                        {(['front', 'side', 'back'] as PhotoType[]).map((type) => {
                                            const url = type === 'front' ? checkin.frontUrl
                                                : type === 'side' ? checkin.sideUrl
                                                    : checkin.backUrl;
                                            const isSelected = selectedPhotoType === type;
                                            const hasPhoto = !!url;

                                            return (
                                                <button
                                                    key={type}
                                                    onClick={() => hasPhoto && setSelectedPhotoType(type)}
                                                    disabled={!hasPhoto}
                                                    className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${isSelected
                                                        ? 'border-[#E0FE10] shadow-lg shadow-[#E0FE10]/20'
                                                        : hasPhoto
                                                            ? 'border-zinc-700 hover:border-zinc-500'
                                                            : 'border-zinc-800 opacity-40'
                                                        }`}
                                                >
                                                    {hasPhoto ? (
                                                        <img
                                                            src={url}
                                                            alt={`${type} thumbnail`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                                            <svg className="w-6 h-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                    <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-2 py-0.5 rounded ${isSelected
                                                        ? 'bg-[#E0FE10] text-black'
                                                        : 'bg-zinc-900/80 text-zinc-300'
                                                        }`}>
                                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Photo Type Indicators */}
                                    <div className="flex items-center justify-center gap-4">
                                        <div className="flex items-center gap-2">
                                            {availablePhotos.map((type) => (
                                                <div
                                                    key={type}
                                                    className={`w-2 h-2 rounded-full transition-colors ${selectedPhotoType === type ? 'bg-[#E0FE10]' : 'bg-zinc-600'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-sm font-medium text-white capitalize">
                                            {selectedPhotoType}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-zinc-800/50 rounded-xl p-8 border border-zinc-700/30 flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 rounded-full bg-zinc-700/50 flex items-center justify-center mb-4">
                                        <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-zinc-400 text-sm text-center">
                                        No progress photos for this check-in
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default CheckinDetailModal;

