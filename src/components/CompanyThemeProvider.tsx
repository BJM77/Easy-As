'use client';

import React, { useMemo } from 'react';
import { useAuth } from '@/firebase';
import { hexToHsl } from '@/lib/utils';

/**
 * A component that injects CSS variables based on the current user's company settings.
 * IMPLEMENTATION: If no active tenant is selected (null context), it falls back to 
 * the "FreightAssist.Online" (easy-as) tenant settings to maintain the Global Master Brand.
 */
export function CompanyThemeProvider() {
  const { company: activeCompany } = useAuth();

  const dynamicStyles = useMemo(() => {
    if (!activeCompany?.settings) return null;

    const { primaryColor, accentColor, topMenuColor, hoverColor } = activeCompany.settings;
    
    let css = ':root {\n';
    
    if (primaryColor) {
      css += `  --primary: ${hexToHsl(primaryColor)};\n`;
      css += `  --ring: ${hexToHsl(primaryColor)};\n`;
    }
    
    if (accentColor) {
      css += `  --accent: ${hexToHsl(accentColor)};\n`;
    }

    if (topMenuColor) {
      css += `  --top-menu: ${hexToHsl(topMenuColor)};\n`;
    }

    if (hoverColor) {
      css += `  --hover-color: ${hexToHsl(hoverColor)};\n`;
    }
    
    css += '}';

    return css;
  }, [activeCompany]);

  if (!dynamicStyles) return null;

  return (
    <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
  );
}
