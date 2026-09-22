
"use client";

import React from 'react';
import { Controller } from 'react-hook-form';
import type { PostcodeData } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import LocationAutocomplete from '@/components/freight/LocationAutocomplete';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

// Define a more specific type for the form prop
interface WizardInputFormProp {
    control: any;
    setValue: (name: any, value: any, options?: { shouldValidate?: boolean; shouldDirty?: boolean }) => void;
}

interface WizardInputProps {
    fieldName: string;
    isLocation?: boolean;
    onLocationSelect: (location: PostcodeData | null) => void;
    autoFocus?: boolean;
    form: WizardInputFormProp;
    allPostcodes: PostcodeData[];
    isSupported: boolean;
    handleVoiceInput: (fieldName: string) => void;
    listening: boolean;
    currentWizardField: string;
    [key: string]: any; // For other props like 'type', 'placeholder'
}


export default function WizardInput({ fieldName, isLocation, onLocationSelect, autoFocus = false, form, allPostcodes, isSupported, handleVoiceInput, listening, currentWizardField, ...props }: WizardInputProps) {
    const handleVoice = () => {
        handleVoiceInput(fieldName);
        if (props.type === 'number') {
            form.setValue(fieldName, '', { shouldValidate: true });
        }
    };
    
    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      event.target.select();
      if (window.innerWidth < 768) { // Only scroll on mobile
          setTimeout(() => {
              event.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
      }
    };
    
    return (
        <div className="relative">
            <Controller
                name={fieldName}
                control={form.control}
                render={({ field }) => {
                    const value = field.value === 0 && (fieldName.includes('Weight') || fieldName.includes('Price') || fieldName.includes('PerWeek') || fieldName.includes('Spend')) ? '' : field.value;
                    
                    return isLocation ? (
                        <LocationAutocomplete
                            inputId={field.name}
                            value={field.value as string}
                            onValueChange={field.onChange}
                            onLocationSelect={(l: PostcodeData | null) => onLocationSelect(l)}
                            allPostcodes={allPostcodes}
                            autoFocus={autoFocus}
                            {...props}
                        />
                    ) : (
                        <Input
                            {...field}
                            value={value}
                            autoFocus={autoFocus}
                            {...props}
                            onFocus={handleFocus}
                        />
                    )
                }}
            />
            {isSupported && (
                <Button type="button" size="icon" variant="ghost" onClick={handleVoice} className="absolute right-1 top-1 h-8 w-8">
                    <Mic className={cn("h-4 w-4", listening && currentWizardField === fieldName ? "text-destructive" : "")}/>
                </Button>
            )}
        </div>
    );
};
