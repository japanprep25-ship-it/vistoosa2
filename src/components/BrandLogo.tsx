import React, { useState } from 'react';

interface BrandLogoProps {
  className?: string;
  imgClassName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showBorder?: boolean;
}

const sizeClasses = {
  xs: 'w-6 h-6 rounded-lg',
  sm: 'w-8 h-8 rounded-xl',
  md: 'w-10 h-10 rounded-xl',
  lg: 'w-16 h-16 rounded-2xl',
  xl: 'w-20 h-20 rounded-3xl',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  imgClassName = '',
  size = 'md',
  showBorder = true,
}) => {
  const [srcIndex, setSrcIndex] = useState(0);

  // Fallback chain guaranteeing logo displays in all environments & offline
  const fallbackSources = [
    '/vistoosa-logo.png',
    '/apple-touch-icon.png',
    '/favicon-48x48.png',
    '/icon.svg',
  ];

  const handleError = () => {
    if (srcIndex < fallbackSources.length - 1) {
      setSrcIndex((prev) => prev + 1);
    }
  };

  const containerSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div
      className={`shrink-0 flex items-center justify-center bg-zinc-950 overflow-hidden ${containerSize} ${
        showBorder
          ? 'border border-amber-500/30 shadow-lg shadow-amber-500/10'
          : ''
      } ${className}`}
    >
      <img
        src={fallbackSources[srcIndex]}
        onError={handleError}
        alt="Vistoosa Logo"
        loading="eager"
        decoding="sync"
        className={`w-full h-full object-contain ${imgClassName}`}
      />
    </div>
  );
};
