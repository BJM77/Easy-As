
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { QrCode, Video, AlertTriangle, Truck, MapPin, Info, ExternalLink, List, ClipboardPaste, Clock, Trash2, PlusCircle, Route as RouteIcon, Loader2, Timer, Save, Sparkles, Camera, Pause, Play, Calendar as CalendarIcon, Package, Map as MapIcon, GripVertical, Download, Box, Lock, Eraser, UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import jsqr from 'jsqr';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAuth, useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import type { PostcodeData, RoutePlannerInput, RoutePlannerOutput, DeliveryRun, Consignment, TimeSensitiveJob, StopStatus } from '@/lib/types';
import { useRateOverrides } from '@/context/RateOverrideContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { planRoute } from '@/app/routing/actions';
import { extractConnoteDetails } from '@/ai/flows/extract-connote-flow';
import { useSession } from '@/context/SessionContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, startOfDay, isToday } from 'date-fns';
import { collection, query, where, doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { extractAddress } from '@/lib/address-utils';
import AddressVerificationDialog from '@/components/live/AddressVerificationDialog';
import { validateAddress } from '@/ai/flows/validate-address-flow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';


interface ScannedInfo extends Consignment {}

interface GroupedStop {
  address: string;
  stops: {
    description: string;
    type: 'Standard' | 'Time Sensitive' | 'Large Parcel';
    id: string; // Add original ID
    status: StopStatus;
  }[];
  hasLargeParcel: boolean;
}

export default function LiveTrackPageContent() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const animationFrameId = useRef<number>();
  const { user, profile, role, loading: authLoading } = useAuth();
  const firestore = useFirestore();

  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const dateString = format(selectedDate, 'yyyy-MM-dd');

  const [runId, setRunId] = useState<string | null>(null);
  const [consignmentList, setConsignmentList] = useState<Consignment[]>([]);
  const [timeSensitiveList, setTimeSensitiveList] = useState<TimeSensitiveJob[]>([]);
  const [startLocation, setStartLocation] = useState('');
  const [routeAnalysis, setRouteAnalysis] = useState<RoutePlannerOutput | null>(null);
  const [runStatus, setRunStatus] = useState<'pending' | 'in_progress' | 'completed'>('pending');

  const [notification, setNotification] = useState<{ type: 'duplicate' | 'success' | 'info'; message: string } | null>(null);
  const fileImportRef = useRef<HTMLInputElement>(null);
  
  const [addressesToVerify, setAddressesToVerify] = useState<any[]>([]);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  
  const isRunLocked = useMemo(() => {
    return runStatus !== 'pending' || !isToday(selectedDate);
  }, [runStatus, selectedDate]);


  useEffect(() => {
    if (notification) {
      const { type, message } = notification;
      if (type === 'duplicate') {
        toast({ title: 'Duplicate', description: message, variant: 'default' });
      } else if (type === 'success') {
        toast({ title: 'Consignment Added', description: message, variant: 'default' });
      } else if (type === 'info') {
        toast({ title: 'Info', description: message });
      }
      setNotification(null);
    }
  }, [notification, toast]);


  const deliveryRunQuery = useMemoFirebase(() => {
    if (!user || !firestore || !profile?.companyId) return null;
    return query(
      collection(firestore, 'deliveryRuns'),
      where('userId', '==', user.uid),
      where('companyId', '==', profile.companyId),
      where('date', '==', dateString)
    );
  }, [user, firestore, profile?.companyId, dateString]);

  const { data: runs, isLoading: isLoadingRuns } = useCollection<DeliveryRun>(deliveryRunQuery);

  useEffect(() => {
    if (runs && runs.length > 0) {
      const run = runs[0];
      setRunId(run.id);
      setConsignmentList(run.consignments || []);
      setTimeSensitiveList(run.timeSensitiveJobs || []);
      setStartLocation(run.startLocation || '');
      setRouteAnalysis(run.routePlan || null);
      setRunStatus(run.status || 'pending');
    } else if (runs && runs.length === 0) {
      setRunId(null);
      setConsignmentList([]);
      setTimeSensitiveList([]);
      setStartLocation('');
      setRouteAnalysis(null);
      setRunStatus('pending');
    }
  }, [runs]);

  const updateRunInFirestore = useCallback(async (updates: Partial<DeliveryRun>) => {
    if (!user || !firestore || !profile?.companyId) return;

    if (runId) {
      const docRef = doc(firestore, 'deliveryRuns', runId);
      updateDocumentNonBlocking(docRef, updates);
    } else {
      const newDocRef = doc(collection(firestore, 'deliveryRuns'));
      const newRun: DeliveryRun = {
        id: newDocRef.id,
        userId: user.uid,
        userEmail: user.email || undefined,
        companyId: profile.companyId,
        date: dateString,
        status: runStatus,
        consignments: consignmentList,
        timeSensitiveJobs: timeSensitiveList,
        routePlan: routeAnalysis,
        startLocation: startLocation,
        ...updates
      };
      setDocumentNonBlocking(newDocRef, newRun, {});
      setRunId(newDocRef.id);
    }
  }, [user, profile?.companyId, firestore, runId, dateString, consignmentList, timeSensitiveList, routeAnalysis, startLocation, runStatus]);

  const [lastScannedItem, setLastScannedItem] = useState<ScannedInfo | null>(null);
  const [showActionButtons, setShowActionButtons] = useState(false);
  const actionButtonsTimer = useRef<NodeJS.Timeout | null>(null);
  
  const [isTimeEntryDialogOpen, setIsTimeEntryDialogOpen] = useState(false);
  const [timeEntryItem, setTimeEntryItem] = useState<{ address: string; time: string; fromScanId?: string } | null>(null);
  
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const { addTokens } = useSession();

  const [manualConnote, setManualConnote] = useState('');
  const [manualCarrier, setManualCarrier] = useState('');
  const [manualAddress, setManualAddress] = useState('');

  const [isCameraDialogOpen, setIsCameraDialogOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const photoVideoRef = useRef<HTMLVideoElement>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isScannerPaused, setIsScannerPaused] = useState(false);
  
  const draggedItem = useRef<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const addConsignmentToList = useCallback((data: Omit<Consignment, 'id' | 'status'>) => {
    setConsignmentList(prev => {
        const isDuplicate = prev.some(item => item.consignmentNumber === data.consignmentNumber && data.consignmentNumber !== 'MANUAL-ENTRY');
        if (isDuplicate) {
            setNotification({ type: 'duplicate', message: `Consignment ${data.consignmentNumber} is already in the list.` });
            return prev;
        }
        const newItem: Consignment = { ...data, id: `con-${Date.now()}-${Math.random()}`, status: 'pending' };
        const newList = [newItem, ...prev];
        updateRunInFirestore({ consignments: newList });
        setLastScannedItem(newItem);
        setShowActionButtons(true);
        if (actionButtonsTimer.current) clearTimeout(actionButtonsTimer.current);
        actionButtonsTimer.current = setTimeout(() => setShowActionButtons(false), 5000); // Show buttons for 5 seconds
        setNotification({ type: 'success', message: `Added: ${newItem.consignmentNumber}` });
        return newList;
    });
  }, [updateRunInFirestore]);

  const parseScannedData = useCallback((data: string): Omit<Consignment, 'id' | 'status'> | null => {
    if (!data) return null;
    let s = data.replace(/\r?\n/g, ' ').replace(/[|><\*]/g, ' ').replace(/\s+/g, ' ').trim();
    
    const connoteRegex = /\b(C?[A-Z0-9]{9,})\b/i;
    let connoteMatch = s.match(connoteRegex);
    if (!connoteMatch) connoteMatch = s.match(/\b(CBEEW\d{6,})\b/i);

    let consignmentNumber = connoteMatch ? connoteMatch[0].toUpperCase() : '';
    if (consignmentNumber.startsWith('C') && consignmentNumber.length > 8) {
        consignmentNumber = consignmentNumber.substring(1);
    }
    
    let carrier = 'Unknown';
    if (consignmentNumber.startsWith('CBEE')) {
        carrier = 'B2C';
    } else if (/^\d+$/.test(consignmentNumber) || consignmentNumber.startsWith('TGE')) {
        carrier = 'IPEC';
    } else if (consignmentNumber.length > 5) {
        carrier = 'Priority';
    }

    const extractedAddress = extractAddress(s);
    return { consignmentNumber, carrier, address: extractedAddress, fullData: data, isLargeParcel: false };
  }, []);

  const scanQRCode = useCallback(() => {
    if (isScannerPaused) {
      if (animationFrameId.current) {
        animationFrameId.current = requestAnimationFrame(scanQRCode);
      }
      return;
    }
    
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsqr(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code) {
          const parsedData = parseScannedData(code.data);
          if (parsedData) {
            addConsignmentToList({ ...parsedData, fullData: code.data });

            if (animationFrameId.current) {
              cancelAnimationFrame(animationFrameId.current);
            }
            setTimeout(() => {
                if (animationFrameId.current !== undefined) {
                    animationFrameId.current = requestAnimationFrame(scanQRCode);
                }
            }, 3000);
            return;
          }
        }
      }
    }
    if (animationFrameId.current !== undefined) {
        animationFrameId.current = requestAnimationFrame(scanQRCode);
    }
  }, [addConsignmentToList, parseScannedData, isScannerPaused]);

  const stopQrScanner = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = undefined;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);
  
  const startQrScanner = useCallback(async () => {
    if (animationFrameId.current || isCameraDialogOpen) return;
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
           throw new Error("Camera not supported by this browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
           videoRef.current.play().catch(e => console.warn("QR Scanner play was interrupted, likely safe to ignore."));
           animationFrameId.current = requestAnimationFrame(scanQRCode);
        }
    } catch (error) {
        console.error('Error accessing camera for QR Scanner:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use the scanner.',
        });
    }
  }, [scanQRCode, isCameraDialogOpen, toast]);

  const handleManualInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    stopQrScanner();
    setter(e.target.value);
  };
  
  const handleManualAdd = () => {
    if (!manualAddress.trim()) {
        toast({ title: 'Address Required', description: 'Please fill out the address field to add a manual consignment.', variant: 'destructive' });
        return;
    }
    const connoteToAdd = manualConnote.trim() || `MANUAL-${Date.now().toString().slice(-4)}`;
    const carrierToAdd = manualCarrier.trim() || 'Manual';

    addConsignmentToList({
        consignmentNumber: connoteToAdd,
        carrier: carrierToAdd,
        address: manualAddress,
        fullData: `MANUAL: ${connoteToAdd}`,
        isLargeParcel: false,
    });
    setManualConnote('');
    setManualCarrier('');
    setManualAddress('');
    startQrScanner();
  };
  
  const handleCaptureAndExtract = async () => {
    if (!photoVideoRef.current || !photoCanvasRef.current) return;
    setIsCapturing(true);

    const video = photoVideoRef.current;
    const canvas = photoCanvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
        toast({ title: "Canvas Error", description: "Could not get canvas context.", variant: "destructive" });
        setIsCapturing(false);
        return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUri = canvas.toDataURL('image/jpeg');

    try {
        const { details } = await extractConnoteDetails({ photoDataUri: dataUri });
        setManualConnote(details.consignmentNumber);
        setManualCarrier(details.carrier);
        setManualAddress(details.address);
        toast({ title: 'Details Extracted', description: 'Please review and add the consignment to the list.' });
        setIsCameraDialogOpen(false);
    } catch (error) {
        console.error("AI extraction failed:", error);
        toast({ title: "Extraction Failed", description: "Could not automatically extract details from the image.", variant: "destructive" });
    } finally {
        setIsCapturing(false);
    }
  };

  const handleCameraDialogOpen = () => {
    stopQrScanner();
    setIsCameraDialogOpen(true);
  };
  
  const handleCameraDialogClose = () => {
    setIsCameraDialogOpen(false);
    startQrScanner();
  };


  useEffect(() => {
    if (isCameraDialogOpen) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
          if (photoVideoRef.current) {
            photoVideoRef.current.srcObject = stream;
            photoVideoRef.current.play().catch(e => console.error("Error playing photo video stream:", e));
          }
        })
        .catch(err => {
          console.error("Error accessing camera for photo capture:", err);
          setHasCameraPermission(false);
          toast({ title: "Camera Error", description: "Could not access the camera.", variant: "destructive" });
        });
    } else {
        if (photoVideoRef.current && photoVideoRef.current.srcObject) {
          const stream = photoVideoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          photoVideoRef.current.srcObject = null;
        }
    }
  }, [isCameraDialogOpen, toast]);


  useEffect(() => {
    if (authLoading) return;
    
    startQrScanner();
    return () => {
      stopQrScanner();
      if (actionButtonsTimer.current) {
        clearTimeout(actionButtonsTimer.current);
      }
    };
  }, [startQrScanner, stopQrScanner, authLoading]);

  const handleRemoveConsignment = (id: string) => {
      const newList = consignmentList.filter(item => item.id !== id);
      setConsignmentList(newList);
      updateRunInFirestore({ consignments: newList });
  };
  
  const handleAddTimeSensitive = () => {
      stopQrScanner();
      const newId = `ts-${Date.now()}`;
      const newList: TimeSensitiveJob[] = [...timeSensitiveList, { id: newId, address: '', time: '', status: 'pending' }];
      setTimeSensitiveList(newList);
      updateRunInFirestore({ timeSensitiveJobs: newList });
      setTimeout(() => {
          document.getElementById(`ts-addr-${newId}`)?.focus();
      }, 100);
  };
  
  const handleRemoveTimeSensitive = (id: string) => {
      const newList = timeSensitiveList.filter(item => item.id !== id);
      setTimeSensitiveList(newList);
      updateRunInFirestore({ timeSensitiveJobs: newList });
  };
  
  const handleTimeSensitiveChange = (id: string, field: 'address' | 'time', value: string) => {
      stopQrScanner();
      const newList = timeSensitiveList.map(item => item.id === id ? { ...item, [field]: value } : item);
      setTimeSensitiveList(newList);
      updateRunInFirestore({ timeSensitiveJobs: newList });
  };

  const handleMoveToTimeSensitive = () => {
      if (!lastScannedItem) return;
      setTimeEntryItem({ address: lastScannedItem.address, time: '', fromScanId: lastScannedItem.id });
      setIsTimeEntryDialogOpen(true);
      setShowActionButtons(false);
      if (actionButtonsTimer.current) clearTimeout(actionButtonsTimer.current);
  };

  const handleMarkAsLargeParcel = () => {
      if (!lastScannedItem) return;
      const newList = consignmentList.map(item =>
        item.id === lastScannedItem.id ? { ...item, isLargeParcel: true } : item
      );
      setConsignmentList(newList);
      updateRunInFirestore({ consignments: newList });
      toast({ title: "Marked as Large Parcel", description: `Consignment ${lastScannedItem.consignmentNumber} updated.` });
      setShowActionButtons(false);
      if (actionButtonsTimer.current) clearTimeout(actionButtonsTimer.current);
  };


  const handleSaveTimeEntry = () => {
    if (!timeEntryItem) return;

    const newTimeSensitiveList = [
        ...timeSensitiveList,
        { id: `ts-${Date.now()}`, address: timeEntryItem.address, time: timeEntryItem.time, status: 'pending' }
    ];
    
    let newConsignmentList = [...consignmentList];
    if (timeEntryItem.fromScanId) {
        newConsignmentList = newConsignmentList.filter(item => item.id !== timeEntryItem.fromScanId);
    }
    
    setTimeSensitiveList(newTimeSensitiveList);
    setConsignmentList(newConsignmentList);
    setRouteAnalysis(null);
    
    updateRunInFirestore({
        timeSensitiveJobs: newTimeSensitiveList,
        consignments: newConsignmentList,
        routePlan: null
    });
    
    toast({ title: "Moved to Time Sensitive", description: `Job for ${timeEntryItem.address} has been updated.` });
    setIsTimeEntryDialogOpen(false);
    setTimeEntryItem(null);
  };
  
  const handleAddressVerificationResult = (approvedAddresses: { originalAddress: string, cleanedAddress: string, itemType: 'consignment' | 'time-sensitive', itemId: string }[]) => {
      const updatedConsignments = [...consignmentList];
      const updatedTimeSensitiveJobs = [...timeSensitiveList];

      approvedAddresses.forEach(item => {
          if (item.itemType === 'consignment') {
              const index = updatedConsignments.findIndex(c => c.id === item.itemId);
              if (index !== -1) updatedConsignments[index].address = item.cleanedAddress;
          } else if (item.itemType === 'time-sensitive') {
              const index = updatedTimeSensitiveJobs.findIndex(j => j.id === item.itemId);
              if (index !== -1) updatedTimeSensitiveJobs[index].address = item.cleanedAddress;
          }
      });
      setConsignmentList(updatedConsignments);
      setTimeSensitiveList(updatedTimeSensitiveJobs);
      
      // Now that addresses are clean, proceed with route planning
      planOptimizedRoute(updatedConsignments, updatedTimeSensitiveJobs);
  };
  
  const planOptimizedRoute = async (cleanConsignments: Consignment[], cleanTimeSensitiveJobs: TimeSensitiveJob[]) => {
     try {
      const timeSensitiveForInput = cleanTimeSensitiveJobs
          .filter(ts => ts.address.trim() !== '')
          .map(ts => ({ type: 'Time Sensitive' as const, address: ts.address, description: `Deliver by ${ts.time}` }));

      const standardStopsForInput = cleanConsignments
          .map(c => ({
              type: c.isLargeParcel ? 'Large Parcel' as const : 'Standard' as const,
              address: c.address,
              description: c.consignmentNumber,
          }));
      
      const routeInput: RoutePlannerInput = {
        startLocation,
        stops: [...timeSensitiveForInput, ...standardStopsForInput],
      };

      const {summary, usage} = await planRoute(routeInput);
      addTokens(usage.totalTokens);
      setRouteAnalysis(summary);
      updateRunInFirestore({ routePlan: summary, startLocation, consignments: cleanConsignments, timeSensitiveJobs: cleanTimeSensitiveJobs });
      toast({ title: "Route Optimized", description: "AI has generated an optimized route plan." });

    } catch (error) {
      console.error("Error generating route:", error);
      toast({ title: "Route Generation Failed", description: error instanceof Error ? error.message : "An unknown error occurred.", variant: 'destructive' });
    } finally {
      setIsGeneratingRoute(false);
    }
  };

  const handleGenerateRoute = async () => {
    if (consignmentList.length === 0 && timeSensitiveList.length === 0) {
        toast({ title: "No consignments", description: "Please add consignments or time-sensitive jobs to generate a route.", variant: "destructive"});
        return;
    }
    if (!startLocation.trim()) {
        toast({ title: "Start Location Required", description: "Please enter a starting location for the route.", variant: "destructive"});
        return;
    }

    setIsGeneratingRoute(true);
    setRouteAnalysis(null);
    
    // --- Start Validation Step ---
    const allStops = [
        ...consignmentList.map(c => ({ originalAddress: c.address, itemType: 'consignment' as const, itemId: c.id })),
        ...timeSensitiveList.map(t => ({ originalAddress: t.address, itemType: 'time-sensitive' as const, itemId: t.id }))
    ];

    const validationPromises = allStops.map(stop => validateAddress({ originalAddress: stop.originalAddress }));

    try {
        const validationResults = await Promise.all(validationPromises);
        const addressesToReview = validationResults
            .map((res, index) => ({ ...res.result, ...allStops[index] }))
            .filter(res => !res.isConfident);

        if (addressesToReview.length > 0) {
            setAddressesToVerify(addressesToReview);
            setIsVerificationDialogOpen(true);
            setIsGeneratingRoute(false); // Pause generation until user verifies
            return;
        }
        
        // If all are confident, proceed directly to route planning with original (but now verified) addresses
        await planOptimizedRoute(consignmentList, timeSensitiveList);

    } catch (error) {
        console.error("Address validation failed:", error);
        toast({ title: "Validation Error", description: "Could not validate addresses. Please try again.", variant: 'destructive'});
        setIsGeneratingRoute(false);
    }
    // --- End Validation Step ---
  };
  
  const handleClearAll = () => {
    setConsignmentList([]);
    setTimeSensitiveList([]);
    setRouteAnalysis(null);
    updateRunInFirestore({
      consignments: [],
      timeSensitiveJobs: [],
      routePlan: null,
    });
    toast({ title: 'Cleared', description: 'All consignments and time-sensitive jobs for this run have been cleared.' });
  };
  
  const handleExportUnroutedCsv = () => {
    const dataToExport = consignmentList;
    if (dataToExport.length === 0) {
        toast({ title: "No Data", description: "There are no consignments to export.", variant: "destructive" });
        return;
    }
    let csvContent = "Address,Description,Type\n";
    dataToExport.forEach(item => {
        const row = `"${item.address.replace(/"/g, '""')}","${item.consignmentNumber.replace(/"/g, '""')}","${item.isLargeParcel ? 'Large Parcel' : 'Standard'}"`;
        csvContent += row + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `unrouted_stops_${dateString}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    window.open('https://www.google.com/maps/d/', '_blank');

    toast({
        title: 'Export Started',
        description: 'Your CSV is downloading and Google My Maps is opening in a new tab.',
    });
  };

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    draggedItem.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    e.preventDefault();
    setDragOverItem(index);
  };
  
  const handleDrop = () => {
    if (draggedItem.current === null || dragOverItem === null || !routeAnalysis) return;
    if (draggedItem.current === dragOverItem) return;

    const newRoute = [...routeAnalysis.optimizedRoute];
    const dragged = newRoute.splice(draggedItem.current, 1)[0];
    newRoute.splice(dragOverItem, 0, dragged);
    
    const newOrderedAddresses = [startLocation, ...newRoute.map(stop => stop.address)];
    
    const googleMapsUrl = `https://www.google.com/maps/dir/${newOrderedAddresses.map(addr => encodeURIComponent(addr)).join('/')}`;

    const newRouteAnalysis = {
        ...routeAnalysis,
        optimizedRoute: newRoute,
        orderedAddresses: newOrderedAddresses,
        googleMapsUrl: googleMapsUrl,
    };

    setRouteAnalysis(newRouteAnalysis);
    updateRunInFirestore({ routePlan: newRouteAnalysis });

    draggedItem.current = null;
    setDragOverItem(null);
  };
  
  const handleRemoveFromRoute = (stopDescription: string, stopType: 'Standard' | 'Time Sensitive' | 'Large Parcel') => {
    if (stopType === 'Time Sensitive') {
      const itemToRemove = timeSensitiveList.find(ts => `Deliver by ${ts.time}` === stopDescription);
      if (itemToRemove) {
        handleRemoveTimeSensitive(itemToRemove.id);
      }
    } else {
      const itemToRemove = consignmentList.find(c => c.consignmentNumber === stopDescription);
      if (itemToRemove) {
        handleRemoveConsignment(itemToRemove.id);
      }
    }
  };

  const handleStatusToggle = (id: string, currentStatus: StopStatus, type: 'consignment' | 'time-sensitive') => {
      const newStatus: StopStatus = currentStatus === 'pending' ? 'completed' : 'pending';
      if (type === 'consignment') {
          const newList = consignmentList.map(c => c.id === id ? { ...c, status: newStatus } : c);
          setConsignmentList(newList);
          updateRunInFirestore({ consignments: newList });
      } else {
          const newList = timeSensitiveList.map(t => t.id === id ? { ...t, status: newStatus } : t);
          setTimeSensitiveList(newList);
          updateRunInFirestore({ timeSensitiveJobs: newList });
      }
  };
  
  const handleOptimizedRouteStatusToggle = (id: string, type: 'Standard' | 'Time Sensitive' | 'Large Parcel') => {
      if (type === 'Time Sensitive') {
        const job = timeSensitiveList.find(t => t.id === id);
        if (job) handleStatusToggle(job.id, job.status, 'time-sensitive');
      } else {
        const connote = consignmentList.find(c => c.id === id);
        if (connote) handleStatusToggle(connote.id, connote.status, 'consignment');
      }
  };

  const pendingConsignments = useMemo(() => consignmentList.filter(c => c.status === 'pending'), [consignmentList]);
  const deliveredConsignments = useMemo(() => consignmentList.filter(c => c.status === 'completed'), [consignmentList]);
  
  const findOriginalItemId = useCallback((stop: RoutePlannerOutput['optimizedRoute'][0]): string => {
    if (stop.type === 'Time Sensitive') {
        const time = stop.description.replace('Deliver by ', '');
        const job = timeSensitiveList.find(j => j.address === stop.address && j.time === time);
        return job?.id || '';
    } else {
        const connote = consignmentList.find(c => c.consignmentNumber === stop.description);
        return connote?.id || '';
    }
  }, [timeSensitiveList, consignmentList]);

  const findOriginalItemStatus = useCallback((stop: RoutePlannerOutput['optimizedRoute'][0]): StopStatus => {
    if (stop.type === 'Time Sensitive') {
      const time = stop.description.replace('Deliver by ', '');
      const job = timeSensitiveList.find(j => j.address === stop.address && j.time === time);
      return job?.status || 'pending';
    } else {
      const connote = consignmentList.find(c => c.consignmentNumber === stop.description);
      return connote?.status || 'pending';
    }
  }, [timeSensitiveList, consignmentList]);
  
  const groupedRoute = useMemo(() => {
    if (!routeAnalysis) return [];
    const addressMap = new Map<string, GroupedStop>();

    routeAnalysis.optimizedRoute.forEach(stop => {
      const originalId = findOriginalItemId(stop);
      const status = findOriginalItemStatus(stop);
      
      let existingGroup = addressMap.get(stop.address);
      if (!existingGroup) {
        existingGroup = { address: stop.address, stops: [], hasLargeParcel: false };
      }
      existingGroup.stops.push({ ...stop, id: originalId, status });
      if (stop.type === 'Large Parcel') existingGroup.hasLargeParcel = true;
      addressMap.set(stop.address, existingGroup);
    });
    return Array.from(addressMap.values());
  }, [routeAnalysis, findOriginalItemId, findOriginalItemStatus]);
  
  const pendingGroupedRoute = useMemo(() => groupedRoute.filter(g => g.stops.some(s => s.status === 'pending')), [groupedRoute]);
  const deliveredGroupedRoute = useMemo(() => groupedRoute.filter(g => g.stops.every(s => s.status === 'completed')), [groupedRoute]);


  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !firestore || !profile?.companyId) { toast({title: "Initialization Error", variant: "destructive"}); return; }
    if (!event.target.files || event.target.files.length === 0) return;
    setIsUploading(true);
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.trim().split(/\r\n|\n/).slice(1); // Skip header

        const newConsignments: Omit<Consignment, 'id' | 'status'>[] = lines.map(line => {
            const [address, description, type] = line.split(',');
            return {
                address: address?.replace(/"/g, '') || '',
                consignmentNumber: description?.replace(/"/g, '') || `MANUAL-${Date.now()}`,
                carrier: 'Imported',
                isLargeParcel: type?.toLowerCase().includes('large') || false,
                fullData: line,
            };
        }).filter(c => c.address);

        setConsignmentList(prev => {
          const combined = [...prev];
          newConsignments.forEach(newItem => {
            if (!combined.some(c => c.consignmentNumber === newItem.consignmentNumber)) {
              combined.unshift({ ...newItem, id: `con-${Date.now()}-${Math.random()}`, status: 'pending' });
            }
          });
          updateRunInFirestore({ consignments: combined });
          return combined;
        });

        toast({ title: 'Import Complete', description: `${newConsignments.length} stops imported from CSV.` });
        setIsUploading(false);
    };

    reader.readAsText(file);
    if (event.target) event.target.value = ''; // Reset file input
  };
  

  if(authLoading || isLoadingRuns) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-16 w-16 animate-spin" /></div>;
  }
  
  return (
    <>
      <div className="space-y-8">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <RouteIcon className="mr-2 h-7 w-7 text-primary" /> AI Route Planner
            </CardTitle>
            <CardDescription>
              Scan QR codes or manually add consignments to build and optimize your delivery route with AI. Data is saved per day for your user account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
               <Label htmlFor="date-picker">Run Date:</Label>
               <Popover>
                  <PopoverTrigger asChild>
                      <Button
                          id="date-picker"
                          variant={"outline"}
                          className="w-[280px] justify-start text-left font-normal"
                      >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(selectedDate, "PPP")}
                      </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                      <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => date && setSelectedDate(startOfDay(date))}
                          initialFocus
                          disabled={(date) => date > new Date() || date < new Date(new Date().setDate(new Date().getDate() - 14))}
                      />
                  </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>
        
        {isRunLocked && (
          <Alert variant="default" className="bg-amber-50 border-amber-500 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              <Lock className="h-4 w-4 text-amber-600" />
              <AlertTitle>Run Locked</AlertTitle>
              <AlertDescription>
                  This delivery run is either completed or from a past date. You can view the details, but you cannot add or edit consignments. Please select today's date to start a new run.
              </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Inputs */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center text-xl">
                      <QrCode className="mr-2 h-6 w-6"/>
                      Scan QR Code
                  </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center overflow-hidden relative">
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-64 h-64 relative">
                            <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-white/80 rounded-tl-lg"></div>
                            <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-white/80 rounded-tr-lg"></div>
                            <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-white/80 rounded-bl-lg"></div>
                            <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-white/80 rounded-br-lg"></div>
                        </div>
                    </div>
                     <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 h-8 w-8 bg-black/30 text-white hover:bg-black/50 hover:text-white"
                        onClick={() => setIsScannerPaused(prev => !prev)}
                        disabled={isRunLocked}
                      >
                        {isScannerPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                        <span className="sr-only">{isScannerPaused ? 'Play Scanner' : 'Pause Scanner'}</span>
                     </Button>
                    {showActionButtons && (
                      <div className="absolute bottom-4 flex gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
                          <Button onClick={handleMoveToTimeSensitive}>
                              <Timer className="mr-2 h-4 w-4" />
                              Time Sensitive
                          </Button>
                          <Button onClick={handleMarkAsLargeParcel} variant="secondary">
                              <Box className="mr-2 h-4 w-4" />
                              Large Parcel
                          </Button>
                      </div>
                    )}
                </div>
                {hasCameraPermission === false && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Camera Access Denied</AlertTitle>
                      <AlertDescription>Enable camera permissions to use the scanner.</AlertDescription>
                    </Alert>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center text-xl">
                      <PlusCircle className="mr-2 h-6 w-6"/>
                      Add Manual Consignment
                  </CardTitle>
                   <Button variant="outline" size="sm" className="w-full" onClick={handleCameraDialogOpen} disabled={isRunLocked}>
                      <Camera className="mr-2 h-4 w-4" /> Scan with Camera
                  </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                          <Label htmlFor="manual-connote">Consignment #</Label>
                          <Input id="manual-connote" value={manualConnote} onChange={handleManualInputChange(setManualConnote)} placeholder="e.g., TGE12345" disabled={isRunLocked} />
                      </div>
                      <div className="space-y-1">
                          <Label htmlFor="manual-carrier">Carrier</Label>
                          <Input id="manual-carrier" value={manualCarrier} onChange={handleManualInputChange(setManualCarrier)} placeholder="e.g., IPEC" disabled={isRunLocked} />
                      </div>
                  </div>
                  <div className="space-y-1">
                      <Label htmlFor="manual-address">Address</Label>
                      <Input id="manual-address" value={manualAddress} onChange={handleManualInputChange(setManualAddress)} placeholder="e.g., 123 Example St, Sydney NSW 2000" disabled={isRunLocked} />
                  </div>
                  <Button onClick={handleManualAdd} className="w-full sm:w-auto" disabled={isRunLocked}>Add to List</Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Lists */}
          <div className="lg:col-span-2 space-y-6">
             <Card>
              <CardHeader>
                  <CardTitle className="flex items-center text-xl">
                      <Clock className="mr-2 h-6 w-6 text-destructive"/>
                      Time Sensitive Deliveries
                  </CardTitle>
                  <CardDescription>Manually add any deliveries with a strict time window (e.g., +/- 15 mins).</CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="space-y-2">
                      {timeSensitiveList.map((item, index) => (
                          <div key={item.id} className="flex items-end gap-2 p-2 bg-muted/50 rounded-md">
                              <Checkbox id={`check-ts-${item.id}`} checked={item.status === 'completed'} onCheckedChange={() => handleStatusToggle(item.id, item.status, 'time-sensitive')} disabled={isRunLocked} className="mt-7" />
                              <div className="flex-grow space-y-1">
                                  <Label htmlFor={`ts-addr-${item.id}`} className="text-xs">Address</Label>
                                  <Input id={`ts-addr-${item.id}`} value={item.address} onChange={e => handleTimeSensitiveChange(item.id, 'address', e.target.value)} placeholder="e.g., 123 Main St, Sydney" disabled={isRunLocked} />
                              </div>
                              <div className="w-32 space-y-1">
                                  <Label htmlFor={`ts-time-${item.id}`} className="text-xs">Required Time</Label>
                                  <Input id={`ts-time-${item.id}`} type="time" value={item.time} onChange={e => handleTimeSensitiveChange(item.id, 'time', e.target.value)} disabled={isRunLocked} />
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveTimeSensitive(item.id)} disabled={isRunLocked}><Trash2 className="h-4 w-4"/></Button>
                          </div>
                      ))}
                  </div>
                  <Button onClick={handleAddTimeSensitive} variant="outline" size="sm" className="mt-2" disabled={isRunLocked}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Time Sensitive Job
                  </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center flex-wrap gap-2">
                    <CardTitle className="flex items-center text-xl">
                        <List className="mr-2 h-6 w-6"/>
                        Consignment List
                    </CardTitle>
                     <div className="flex gap-2">
                        <Input type="file" accept=".csv" ref={fileImportRef} className="hidden" onChange={handleFileImport} />
                        <Button variant="outline" size="sm" onClick={() => fileImportRef.current?.click()} disabled={isRunLocked || isUploading}>
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4"/>} Import from Maps
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleExportUnroutedCsv()} disabled={consignmentList.length === 0}>
                            <ExternalLink className="mr-2 h-4 w-4"/> Export to Maps
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleClearAll} disabled={isRunLocked || (consignmentList.length === 0 && timeSensitiveList.length === 0)}>
                            <Eraser className="mr-2 h-4 w-4"/>
                            Clear All
                        </Button>
                     </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pending">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pending">Pending ({pendingConsignments.length})</TabsTrigger>
                    <TabsTrigger value="delivered">Delivered ({deliveredConsignments.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pending">
                    {pendingConsignments.length > 0 ? (
                        <div className="max-h-96 overflow-y-auto space-y-2 pr-2 mt-4">
                          {pendingConsignments.map(item => (
                              <div key={item.id} className="flex items-start justify-between p-2 border rounded-md">
                                  <div className="flex items-center gap-3">
                                      <Checkbox id={`check-${item.id}`} onCheckedChange={() => handleStatusToggle(item.id, 'pending', 'consignment')} disabled={isRunLocked} />
                                      <div>
                                        <p className="font-semibold">{item.address}</p>
                                        <p className="text-xs text-muted-foreground font-mono">{item.consignmentNumber} - {item.carrier}</p>
                                        {item.isLargeParcel && <Badge variant="secondary" className="mt-1">Large Parcel</Badge>}
                                      </div>
                                  </div>
                                  <Button variant="ghost" size="icon" onClick={() => handleRemoveConsignment(item.id)} disabled={isRunLocked}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                              </div>
                          ))}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-4">No pending consignments.</p>
                    )}
                  </TabsContent>
                  <TabsContent value="delivered">
                     {deliveredConsignments.length > 0 ? (
                        <div className="max-h-96 overflow-y-auto space-y-2 pr-2 mt-4">
                          {deliveredConsignments.map(item => (
                              <div key={item.id} className="flex items-start justify-between p-2 border rounded-md opacity-60">
                                  <div className="flex items-center gap-3">
                                      <Checkbox id={`check-${item.id}`} checked onCheckedChange={() => handleStatusToggle(item.id, 'completed', 'consignment')} disabled={isRunLocked} />
                                      <div>
                                        <p className="font-semibold line-through">{item.address}</p>
                                        <p className="text-xs text-muted-foreground font-mono line-through">{item.consignmentNumber} - {item.carrier}</p>
                                      </div>
                                  </div>
                                  <Button variant="ghost" size="icon" onClick={() => handleRemoveConsignment(item.id)} disabled={isRunLocked}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                              </div>
                          ))}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-4">No consignments delivered yet.</p>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
              <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center text-xl"><RouteIcon className="mr-2 h-6 w-6"/>Generate Route</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="space-y-4">
                          <div className="space-y-1">
                              <Label htmlFor="start-location">Start/Depot Location</Label>
                              <Select value={startLocation} onValueChange={(value) => { setStartLocation(value); updateRunInFirestore({ startLocation: value }); }} disabled={isRunLocked}>
                                  <SelectTrigger id="start-location">
                                      <SelectValue placeholder="Select depot..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="Perth Priority Depot 32 Snook Road Perth Airport 6105">Perth Priority Depot 32 Snook Road Perth Airport 6105</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                          <div className="flex flex-wrap gap-2">
                              <Button className="flex-grow" onClick={handleGenerateRoute} disabled={isGeneratingRoute || (consignmentList.length === 0 && timeSensitiveList.length === 0) || isRunLocked}>
                                 {isGeneratingRoute ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                                 Generate AI Optimized Route
                              </Button>
                          </div>
                      </div>
                  </CardContent>
              </Card>
              {routeAnalysis && (
                  <Card>
                      <CardHeader>
                          <CardTitle className="flex items-center text-xl">AI Route Analysis</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
                              <div className="flex justify-between"><strong>Optimized Stops:</strong> <span>{routeAnalysis.optimizedRoute.length}</span></div>
                              <div className="flex justify-between"><strong>Estimated Time:</strong> <span>{routeAnalysis.estimatedTime}</span></div>
                          </div>
                          {routeAnalysis.potentialRisks.length > 0 && (
                              <div>
                                  <h4 className="font-semibold text-destructive">Potential Risks</h4>
                                  <ul className="list-disc list-inside text-sm text-destructive">
                                      {routeAnalysis.potentialRisks.map((risk, i) => <li key={i}>{risk}</li>)}
                                  </ul>
                              </div>
                          )}
                           <Tabs defaultValue="pending-route">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="pending-route">Pending ({pendingGroupedRoute.length})</TabsTrigger>
                                <TabsTrigger value="delivered-route">Delivered ({deliveredGroupedRoute.length})</TabsTrigger>
                              </TabsList>
                              <TabsContent value="pending-route">
                                <ol className="list-decimal list-inside space-y-2 mt-4">
                                  {pendingGroupedRoute.map((group, i) => (
                                    <li key={`pending-group-${i}`} className="pl-2 border-l-4" style={{ borderColor: i === dragOverItem ? 'hsl(var(--primary))' : 'transparent' }}>
                                      {group.stops.map((stop, stopIndex) => (
                                        <div key={stop.id} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-2">
                                                <Checkbox id={`check-route-${stop.id}`} onCheckedChange={() => handleOptimizedRouteStatusToggle(stop.id, stop.type)} disabled={isRunLocked} />
                                                <Label htmlFor={`check-route-${stop.id}`} className={cn("font-medium", group.hasLargeParcel && "text-orange-600 dark:text-orange-400")}>{stop.address}</Label>
                                            </div>
                                            <div className="flex items-center">
                                                <span className="text-xs text-muted-foreground mr-2">{stop.description}</span>
                                                <Button asChild variant="ghost" size="icon" className="h-8 w-8"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                                            </div>
                                        </div>
                                      ))}
                                    </li>
                                  ))}
                                </ol>
                                {pendingGroupedRoute.length === 0 && <p className="text-center text-muted-foreground py-4">All stops delivered!</p>}
                              </TabsContent>
                               <TabsContent value="delivered-route">
                                <ol className="list-decimal list-inside space-y-2 mt-4">
                                  {deliveredGroupedRoute.map((group, i) => (
                                    <li key={`delivered-group-${i}`} className="pl-2 opacity-60">
                                      {group.stops.map((stop, stopIndex) => (
                                        <div key={stop.id} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Checkbox id={`check-route-delivered-${stop.id}`} checked onCheckedChange={() => handleOptimizedRouteStatusToggle(stop.id, stop.type)} disabled={isRunLocked} />
                                                <Label htmlFor={`check-route-delivered-${stop.id}`} className="font-medium line-through">{stop.address}</Label>
                                            </div>
                                            <span className="text-xs text-muted-foreground line-through">{stop.description}</span>
                                        </div>
                                      ))}
                                    </li>
                                  ))}
                                </ol>
                                {deliveredGroupedRoute.length === 0 && <p className="text-center text-muted-foreground py-4">No stops delivered yet.</p>}
                              </TabsContent>
                           </Tabs>
                      </CardContent>
                      <CardFooter className="flex flex-col sm:flex-row gap-2">
                           <Button asChild className="w-full flex-1">
                              <a href={routeAnalysis.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="mr-2 h-4 w-4" /> Open Full Route in Maps
                              </a>
                          </Button>
                          <Button onClick={handleExportUnroutedCsv} variant="outline" className="w-full flex-1">
                              <Download className="mr-2 h-4 w-4" /> Export for My Maps
                          </Button>
                      </CardFooter>
                  </Card>
              )}
          </div>
        </div>
        <Dialog open={isTimeEntryDialogOpen} onOpenChange={setIsTimeEntryDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Set Required Time</DialogTitle>
              <DialogDescription>
                Enter the required delivery time for: <br />
                <strong className="text-foreground">{timeEntryItem?.address}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="time-entry-input">Required Time</Label>
              <Input
                id="time-entry-input"
                type="time"
                value={timeEntryItem?.time || ''}
                onChange={(e) => setTimeEntryItem(prev => prev ? { ...prev, time: e.target.value } : null)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSaveTimeEntry}>
                <Save className="mr-2 h-4 w-4" />
                Save Time
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isCameraDialogOpen} onOpenChange={handleCameraDialogClose}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Scan Consignment Note</DialogTitle>
              </DialogHeader>
              <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center overflow-hidden relative">
                  <video ref={photoVideoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  <canvas ref={photoCanvasRef} className="hidden" />
              </div>
              <DialogFooter>
                  <Button onClick={handleCaptureAndExtract} disabled={isCapturing}>
                      {isCapturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Camera className="mr-2 h-4 w-4"/>}
                      Capture & Extract Details
                  </Button>
              </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <AddressVerificationDialog 
        isOpen={isVerificationDialogOpen}
        onOpenChange={setIsVerificationDialogOpen}
        addressesToVerify={addressesToVerify}
        onComplete={handleAddressVerificationResult}
      />
    </>
  );
}
