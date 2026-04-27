'use client';

import React, { useMemo } from 'react';
import { useAuth, useDoc, useFirestore } from '@/firebase';
import { hexToHsl } from '@/lib/utils';
import { doc } from 'firebase/firestore';

/**
 * A component that injects CSS variables based on the current user's company settings.
 * IMPLEMENTATION: If no active tenant is selected (null context), it falls back to 
 * the "Just Easy" (easy-as) tenant settings to maintain the Global Master Brand.
 */
export function CompanyThemeProvider() {
  const { company: activeCompany } = useAuth();
  const firestore = useFirestore();

  // Explicitly listen to the 'Just Easy' tenant for the global fallback
  const defaultRef = useMemo(() => firestore ? doc(firestore, 'companies', 'easy-as') : null, [firestore]);
  const { data: defaultCompany } = useDoc(defaultRef);

  // Resolve hierarchy: Active Selected Tenant > Just Easy Fallback
  const company = activeCompany || defaultCompany;

  const dynamicStyles = useMemo(() => {
    if (!company?.settings) return null;

    const { primaryColor, accentColor, topMenuColor, hoverColor } = company.settings;
    
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
  }, [company]);

  if (!dynamicStyles) return null;

  return (
    <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
  );
}
