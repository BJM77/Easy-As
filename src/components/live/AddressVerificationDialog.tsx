"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ArrowRight } from 'lucide-react';
import type { AddressValidationOutput } from '@/ai/flows/validate-address-flow';

interface AddressToVerify extends AddressValidationOutput {
  itemType: 'consignment' | 'time-sensitive';
  itemId: string;
}

interface AddressVerificationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  addressesToVerify: AddressToVerify[];
  onComplete: (approvedAddresses: { originalAddress: string, cleanedAddress: string, itemType: 'consignment' | 'time-sensitive', itemId: string }[]) => void;
}

export default function AddressVerificationDialog({ isOpen, onOpenChange, addressesToVerify, onComplete }: AddressVerificationDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctedAddresses, setCorrectedAddresses] = useState<any[]>([]);
  const [manualEditMode, setManualEditMode] = useState(false);
  const [manualAddress, setManualAddress] = useState({
    streetNumber: '',
    streetName: '',
    suburb: '',
    state: '',
    postcode: '',
  });

  const currentAddress = addressesToVerify[currentIndex];

  const handleNext = (useCleaned: boolean) => {
    const addressToStore = {
      ...currentAddress,
      cleanedAddress: useCleaned ? currentAddress.cleanedAddress : (manualEditMode ? `${manualAddress.streetNumber} ${manualAddress.streetName}, ${manualAddress.suburb} ${manualAddress.state} ${manualAddress.postcode}`.trim() : currentAddress.originalAddress)
    };
    
    const newCorrected = [...correctedAddresses, addressToStore];
    setCorrectedAddresses(newCorrected);

    if (currentIndex + 1 < addressesToVerify.length) {
      setCurrentIndex(currentIndex + 1);
      setManualEditMode(false);
      setManualAddress({ streetNumber: '', streetName: '', suburb: '', state: '', postcode: '' });
    } else {
      onComplete(newCorrected);
      onOpenChange(false);
      // Reset for next time
      setCurrentIndex(0);
      setCorrectedAddresses([]);
    }
  };

  const handleDecline = () => {
    setManualAddress({
        streetNumber: currentAddress.streetNumber || '',
        streetName: currentAddress.streetName || '',
        suburb: currentAddress.suburb || '',
        state: currentAddress.state || '',
        postcode: currentAddress.postcode || '',
    });
    setManualEditMode(true);
  };
  
  const handleManualSave = () => {
    handleNext(false); // Use the manually entered address
  };

  if (!isOpen || !currentAddress) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertCircle className="mr-2 h-6 w-6 text-amber-500" />
            Address Verification ({currentIndex + 1} of {addressesToVerify.length})
          </DialogTitle>
          <DialogDescription>
            The AI has flagged some addresses that may be incomplete or incorrect. Please review and confirm.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-destructive">Reason for flag:</CardTitle>
              <p className="text-sm">{currentAddress.reason}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <Label>Original Scanned Address</Label>
                <p className="font-mono text-sm">{currentAddress.originalAddress}</p>
              </div>
              
              {!manualEditMode ? (
                <>
                  <div className="flex justify-center items-center">
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <Label>AI Suggested Correction</Label>
                    <p className="font-mono text-sm font-semibold">{currentAddress.cleanedAddress}</p>
                  </div>
                </>
              ) : (
                <div className="p-3 border rounded-md space-y-2">
                    <h4 className="text-sm font-semibold">Manual Correction</h4>
                     <div className="grid grid-cols-2 gap-2">
                         <div className="space-y-1 col-span-2">
                            <Label htmlFor="streetNumber" className="text-xs">Unit / Street Number</Label>
                            <Input id="streetNumber" value={manualAddress.streetNumber} onChange={e => setManualAddress(p => ({...p, streetNumber: e.target.value}))} />
                         </div>
                         <div className="space-y-1 col-span-2">
                            <Label htmlFor="streetName" className="text-xs">Street Name & Type</Label>
                            <Input id="streetName" value={manualAddress.streetName} onChange={e => setManualAddress(p => ({...p, streetName: e.target.value}))} />
                         </div>
                         <div className="space-y-1">
                            <Label htmlFor="suburb" className="text-xs">Suburb</Label>
                            <Input id="suburb" value={manualAddress.suburb} onChange={e => setManualAddress(p => ({...p, suburb: e.target.value}))} />
                         </div>
                          <div className="space-y-1">
                            <Label htmlFor="state" className="text-xs">State</Label>
                            <Input id="state" value={manualAddress.state} onChange={e => setManualAddress(p => ({...p, state: e.target.value}))} />
                         </div>
                         <div className="space-y-1">
                            <Label htmlFor="postcode" className="text-xs">Postcode</Label>
                            <Input id="postcode" value={manualAddress.postcode} onChange={e => setManualAddress(p => ({...p, postcode: e.target.value}))} />
                         </div>
                    </div>
                </div>
              )}

            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          {manualEditMode ? (
            <div className="flex justify-between w-full">
               <Button variant="outline" onClick={() => setManualEditMode(false)}>Back to Suggestion</Button>
               <Button onClick={handleManualSave}>Save & Continue</Button>
            </div>
          ) : (
            <div className="flex justify-between w-full">
              <Button variant="destructive" onClick={handleDecline}>Decline Suggestion</Button>
              <Button onClick={() => handleNext(true)}>Approve & Continue</Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
