import React, { useState, useEffect } from 'react';
import { useBrand } from '../contexts/BrandContext';
import logoLight from '../assets/images/vistoosa-logo.png';
import logoDark from '../assets/images/vistoosa-logo-dark.png';

interface BrandLogoProps {
  className?: string;
  imgClassName?: string;
  heightPx?: number;
  size?: 'sm' | 'md' | 'lg' | number;
  isDark?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  imgClassName = '',
  heightPx,
  size,
  isDark = true,
}) => {
  const { meta, getLogoUrl } = useBrand();
  const [hasError, setHasError] = useState(false);

  let computedHeight = 40;
  if (heightPx) {
    computedHeight = heightPx;
  } else if (typeof size === 'number') {
    computedHeight = size;
  } else if (size === 'sm') {
    computedHeight = 28;
  } else if (size === 'md') {
    computedHeight = 40;
  } else if (size === 'lg') {
    computedHeight = 64;
  }

  // Reset error state when version changes
  useEffect(() => {
    setHasError(false);
  }, [meta.version]);

  const defaultLogo = isDark ? logoDark || logoLight : logoLight;

  let logoSrc = defaultLogo;
  if (meta.hasCustomLogo && !hasError) {
    logoSrc = getLogoUrl(isDark);
  }

  const needsWhiteTile = isDark && meta.hasCustomLogo && !meta.hasDarkLogo && !hasError;

  return (
    <div className={`shrink-0 inline-flex items-center justify-center bg-transparent border-0 p-0 m-0 shadow-none outline-none ring-0 ${className}`}>
      {needsWhiteTile ? (
        <div className="p-1 rounded-xl bg-white/90 shadow-sm flex items-center justify-center">
          <img
            src={logoSrc}
            onError={() => setHasError(true)}
            alt="Vistoosa Logo"
            loading="eager"
            decoding="sync"
            style={{ height: `${computedHeight - 8}px`, width: 'auto' }}
            className={`object-contain bg-transparent border-0 p-0 m-0 transition-opacity ${imgClassName}`}
          />
        </div>
      ) : (
        <img
          src={logoSrc}
          onError={() => setHasError(true)}
          alt="Vistoosa Logo"
          loading="eager"
          decoding="sync"
          style={{ height: `${computedHeight}px`, width: 'auto' }}
          className={`object-contain bg-transparent border-0 p-0 m-0 shadow-none transition-opacity ${imgClassName}`}
        />
      )}
    </div>
  );
};
