"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { PostcodeData } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Loader2, History } from 'lucide-react'; 
import { useRateOverrides } from '@/context/RateOverrideContext';

interface LocationAutocompleteProps {
  inputId: string;
  value: string;
  onValueChange: (value: string) => void;
  onLocationSelect: (location: PostcodeData | null) => void;
  allPostcodes?: PostcodeData[];
  placeholder?: string;
  className?: string;
  showRecentSuggestions?: boolean;
  autoFocus?: boolean;
}

const MAX_RECENT_LOCATIONS = 5;
const RECENT_LOCATIONS_KEY_PREFIX = 'justeasy_recent_locations_';

export default function LocationAutocomplete({
  inputId,
  value,
  onValueChange,
  onLocationSelect,
  placeholder,
  className,
  showRecentSuggestions = true,
  autoFocus = false,
}: LocationAutocompleteProps) {
  const { allPostcodes: contextPostcodes, isLoading: isContextLoading } = useRateOverrides();
  const [isFocused, setIsFocused] = useState(false);
  const [recentLocations, setRecentLocations] = useState<PostcodeData[]>([]);

  useEffect(() => {
    const key = `${RECENT_LOCATIONS_KEY_PREFIX}${inputId}`;
    try {
      const storedRecent = localStorage.getItem(key);
      if (storedRecent) {
        setRecentLocations(JSON.parse(storedRecent));
      }
    } catch (error) {
      console.error("Error loading recent locations:", error);
      localStorage.removeItem(key);
    }
  }, [inputId]);

  const allPostcodes = contextPostcodes || [];

  const suggestions = useMemo(() => {
    if (!value || value.trim().length < 2 || !allPostcodes || allPostcodes.length === 0) {
      return [];
    }
    const lowercasedInput = value.toLowerCase().trim();
    if (!lowercasedInput) return [];

    const startsWithMatches: PostcodeData[] = [];
    const includesMatches: PostcodeData[] = [];

    for (const loc of allPostcodes) {
      const suburb = (loc.suburb || "").toLowerCase();
      const postcode = loc.postcode?.toString() || "";

      if (suburb.startsWith(lowercasedInput) || postcode.startsWith(lowercasedInput)) {
        startsWithMatches.push(loc);
      } else if (suburb.includes(lowercasedInput)) {
        includesMatches.push(loc);
      }
    }

    return [...startsWithMatches, ...includesMatches].slice(0, 5);
  }, [value, allPostcodes]);

  const handleSelect = (location: PostcodeData) => {
    onValueChange(`${location.suburb} ${location.state} ${location.postcode}`);
    onLocationSelect(location);
    setIsFocused(false);

    if (showRecentSuggestions) {
      setRecentLocations(prevRecent => {
        const newRecent = [location, ...prevRecent.filter(loc => loc.postcode !== location.postcode || loc.suburb.toLowerCase() !== location.suburb.toLowerCase())];
        const limitedRecent = newRecent.slice(0, MAX_RECENT_LOCATIONS);
        const key = `${RECENT_LOCATIONS_KEY_PREFIX}${inputId}`;
        try {
          localStorage.setItem(key, JSON.stringify(limitedRecent));
        } catch (error) {
          console.error("Error saving recent locations:", error);
        }
        return limitedRecent;
      });
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newInputValue = e.target.value;
    onValueChange(newInputValue);
    if (!newInputValue.trim()) { 
      onLocationSelect(null); 
    }
  };

  const showRecentSuggestionsList = 
    isFocused && 
    showRecentSuggestions && 
    (!value || value.trim().length < 2) &&
    !isContextLoading && 
    recentLocations.length > 0;

  const showSearchResultsList = 
    isFocused && 
    suggestions.length > 0 && 
    !isContextLoading && 
    value && value.trim().length >= 2;

  return (
    <div className={cn("relative w-full", className)}>
      <Input
        id={inputId}
        type="text"
        value={value || ''}
        onChange={handleInputChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setTimeout(() => {
            setIsFocused(false);
          }, 200);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="pr-10"
        autoFocus={autoFocus}
      />
      {isContextLoading && ( 
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      
      {(showRecentSuggestionsList || showSearchResultsList) && (
        <div className="absolute top-full left-0 z-20 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg">
          <ScrollArea className="max-h-60 overflow-y-auto">
            {showRecentSuggestionsList && (
              <>
                <div className="px-3 py-2 text-xs text-muted-foreground flex items-center">
                  <History className="mr-1.5 h-3 w-3" /> Recent Locations:
                </div>
                <ul className="py-1">
                  {recentLocations.map((location, index) => (
                    <li
                      key={`recent-${location.postcode}-${location.suburb}-${index}`}
                      className="cursor-pointer px-3 py-2 hover:bg-accent hover:text-accent-foreground text-sm"
                      onMouseDown={() => handleSelect(location)}
                    >
                      {location.suburb}, {location.state} {location.postcode}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {showSearchResultsList && (
              <ul className="py-1">
                {suggestions.map((location, index) => (
                  <li
                    key={`${location.postcode}-${location.suburb}-${index}`}
                    className="cursor-pointer px-3 py-2 hover:bg-accent hover:text-accent-foreground text-sm"
                    onMouseDown={() => handleSelect(location)}
                  >
                    {location.suburb}, {location.state} {location.postcode}
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
