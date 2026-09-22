
'use client';

import React from 'react';
import { useFieldArray, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2 } from 'lucide-react';
import type { ServiceName } from '@/lib/types';

interface ServiceLegsFieldArrayProps {
  control: any;
  destIndex: number;
  servicesForSelection: ServiceName[];
}

export default function ServiceLegsFieldArray({
  control,
  destIndex,
  servicesForSelection,
}: ServiceLegsFieldArrayProps) {
  const { fields, append, remove } = useFieldArray({
    control: control,
    name: `destinations.${destIndex}.serviceLegs`,
  });

  return (
    <div className="space-y-3 pt-3">
      <Label className="text-sm font-semibold">Service Comparison Legs</Label>
      {fields.map((leg, legIndex) => (
        <div
          key={leg.id}
          className="grid grid-cols-[1fr,1fr,1fr,auto] gap-2 items-end p-2 border rounded-md bg-background"
        >
          <div className="space-y-1">
            <Label className="text-[10px] uppercase">Service</Label>
            <Controller
              name={`destinations.${destIndex}.serviceLegs.${legIndex}.service`}
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {servicesForSelection.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase">Avg. Wt (kg)</Label>
            <Controller
              name={`destinations.${destIndex}.serviceLegs.${legIndex}.averageWeight`}
              control={control}
              render={({ field }) => (
                <Input
                  type="number"
                  {...field}
                  className="h-8 text-xs"
                  onFocus={(e) => e.target.select()}
                />
              )}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase">Target ($)</Label>
            <Controller
              name={`destinations.${destIndex}.serviceLegs.${legIndex}.targetPrice`}
              control={control}
              render={({ field }) => (
                <Input
                  type="number"
                  {...field}
                  className="h-8 text-xs"
                  onFocus={(e) => e.target.select()}
                />
              )}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(legIndex)}
            disabled={fields.length <= 1}
            className="h-8 w-8"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-[10px]"
        onClick={() =>
          append({
            id: `leg-${Date.now()}`,
            service: 'B2B Std',
            averageWeight: 0,
            targetPrice: 0,
          })
        }
      >
        <PlusCircle className="mr-1 h-3 w-3" /> Add Service Leg
      </Button>
    </div>
  );
}
