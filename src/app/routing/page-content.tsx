
"use client";

import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Route as RouteIcon,
  QrCode,
  Video,
  AlertTriangle,
  Truck,
  MapPin,
  Info,
  ExternalLink,
  List,
  ClipboardPaste,
  Clock,
  Trash2,
  PlusCircle,
  Loader2,
  Timer,
  Save,
  Sparkles,
  Camera,
  Pause,
  Play,
  FileJson,
  UploadCloud,
  X as XIcon,
  Download,
} from 'lucide-react';
import {useToast} from '@/hooks/use-toast';
import {Alert, AlertTitle, AlertDescription} from '@/components/ui/alert';
import jsqr from 'jsqr';
import {Button} from '@/components/ui/button';
import {Label} from '@/components/ui/label';
import {Input} from '@/components/ui/input';
import {
  RoutePlannerOutput,
  TimeSensitiveJob,
} from '@/lib/types';
import {
  planRoute,
} from './actions';
import {
  RoutePlannerInput,
} from '@/ai/flows/route-planner-flow';
import {useSession} from '@/context/SessionContext';
import {extractConnoteDetails} from '@/ai/flows/extract-connote-flow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import * as XLSX from 'xlsx';

type StopType = 'Standard' | 'Large Parcel';

interface Stop {
  type: StopType;
  address: string;
  description: string;
}

const parseScannedData = (
  data: string
): {consignmentNumber: string; name: string; address: string} | null => {
  if (!data) return null;
  const raw = data.trim();
  let s = raw
    .replace(/\r?\n/g, ' ')
    .replace(/[|><\*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Use a more flexible regex to find connotes starting with 'C' followed by letters and numbers.
  const connoteRegex = /\b(C[A-Z0-9]{10})\b/;
  const connoteMatch = s.match(connoteRegex);
  const consignmentNumber = connoteMatch ? connoteMatch[0] : 'UNKNOWN_CONNOTE';

  const nameAndAddressTokenMatch = s.match(/\s(S\d{5,})\s/);
  let name = 'Name Not Found';
  let address = extractAddress(s);

  if (nameAndAddressTokenMatch && nameAndAddressTokenMatch.index) {
    const startIndex =
      nameAndAddressTokenMatch.index + nameAndAddressTokenMatch[0].length;
    let relevantPart = s.substring(startIndex);

    const endIndex = relevantPart.indexOf(' AU');
    if (endIndex !== -1) {
      const nameAndAddressBlock = relevantPart.substring(0, endIndex).trim();

      const addressStartIndex = nameAndAddressBlock.search(/\s\d+\s/);
      if (addressStartIndex > 0) {
        name = nameAndAddressBlock.substring(0, addressStartIndex).trim();
      } else {
        const words = nameAndAddressBlock.split(' ');
        if (words.length > 2 && isNaN(parseInt(words[2], 10))) {
          name = `${words[0]} ${words[1]}`;
        } else if (words.length > 1) {
          name = words[0];
        }
      }
    }
  }

  return {consignmentNumber, name, address};
};

const stateAbbreviations = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const streetTypes = [
  'Street',
  'St',
  'Road',
  'Rd',
  'Avenue',
  'Ave',
  'Drive',
  'Dr',
  'Court',
  'Ct',
  'Crescent',
  'Cres',
  'Place',
  'Pl',
  'Grove',
  'Lane',
  'Ln',
  'Terrace',
  'Tce',
  'Way',
  'Walk',
  'Boulevard',
  'Bvd',
  'Parade',
  'Pde',
];
const streetTypesPattern = streetTypes.join('|');

function removeLogisticTokens(text: string) {
  return text
    .replace(/\++/g, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(
      /\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]+\b/g,
      t => {
        return t.length <= 3 ? t : ' ';
      }
    )
    .replace(/\b[A-Z0-9]{5,}\b/g, ' ')
    .replace(/\b[SNY]{1,2}\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const extractAddress = (data: string): string => {
  if (!data) return '';

  const raw = data.trim();

  try {
    if (/^https?:\/\//i.test(raw)) {
      new URL(raw);
      return raw;
    }
  } catch (e) {}

  let s = raw
    .replace(/\r?\n/g, ' ')
    .replace(/[|><\*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const postcodeRegex = /\b([0-9]{4})\b/g;
  const candidates: {code: string; index: number}[] = [];
  let m;
  while ((m = postcodeRegex.exec(s)) !== null) {
    candidates.push({code: m[1], index: m.index});
  }

  if (candidates.length > 0) {
    const scored = candidates.map(c => {
      const lookback = s.substring(Math.max(0, c.index - 140), c.index);
      const letters = (lookback.match(/[A-Za-z]/g) || []).length;
      const stateNear = new RegExp(
        `\\b(${stateAbbreviations.join('|')})\\b`,
        'i'
      ).test(lookback + s.substring(c.index, c.index + 6));
      const score = letters + (stateNear ? 40 : 0);
      return {...c, score};
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    const start = Math.max(0, best.index - 200);
    let window = s.substring(start, best.index + 4); // include postcode
    window = removeLogisticTokens(window);

    const streetRegex = new RegExp(
      `(\\d{1,4}[A-Za-z]?\\/?\\d{0,4}\\s+[A-Za-z0-9'\\-]+(?:\\s+[A-Za-z0-9'\\-]+){0,5}\\s+(?:${streetTypesPattern})\\b)(?:[\\s,\\-]*)` +
        `([A-Za-z'\\-]+(?:\\s+[A-Za-z'\\-]+){0,4})?\\s*(${best.code})`,
      'i'
    );

    const streetMatch = window.match(streetRegex);
    if (streetMatch) {
      const street = streetMatch[1].trim();
      const suburb = (streetMatch[2] || '').trim();
      let result = street + (suburb ? `, ${suburb}` : '') + ` ${best.code}`;
      const stateMatch = s
        .substring(Math.max(0, best.index - 40), best.index + 6)
        .match(new RegExp(`\\b(${stateAbbreviations.join('|')})\\b`, 'i'));
      if (stateMatch) result = `${result} ${stateMatch[1].toUpperCase()}`;
      return result.replace(/\s+/g, ' ').trim();
    }

    const capitalSeq = window.match(
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})\s*([0-9]{4})/
    );
    if (capitalSeq) {
      let result = `${capitalSeq[1].trim()} ${capitalSeq[2]}`;
      const stateMatch = s
        .substring(Math.max(0, best.index - 40), best.index + 6)
        .match(new RegExp(`\\b(${stateAbbreviations.join('|')})\\b`, 'i'));
      if (stateMatch) result += ` ${stateMatch[1].toUpperCase()}`;
      return result;
    }

    let cleaned = removeLogisticTokens(window);
    if (!/\b\d{4}\b/.test(cleaned)) cleaned = `${cleaned} ${best.code}`;
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    return cleaned;
  }

  const streetLike = s.match(
    new RegExp(
      `(\\d{1,4}[A-Za-z]?\\s+[A-Za-z\\-']+(?:\\s+[A-Za-z\\-']+){0,4}\\s+(?:${streetTypesPattern}))`,
      'i'
    )
  );
  if (streetLike) {
    return removeLogisticTokens(streetLike[1]);
  }

  const fallback = removeLogisticTokens(s)
    .split(/\s+/)
    .slice(0, 10)
    .join(' ');
  return fallback;
};

export default function RoutingPageContent() {
  const [startLocation, setStartLocation] = useState(
    '32 Snook Road, Perth Airport, WA 6105'
  );
  const [stops, setStops] = useState<Stop[]>([]);
  const [timeSensitiveStops, setTimeSensitiveStops] = useState<
    TimeSensitiveJob[]
  >([]);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [routePlan, setRoutePlan] = useState<RoutePlannerOutput | null>(null);
  const {addTokens} = useSession();
  const {toast} = useToast();

  const [hasCameraPermission, setHasCameraPermission] = useState<
    boolean | null
  >(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScannerPaused, setIsScannerPaused] = useState(false);
  const animationFrameId = useRef<number>();

  const [lastRawScan, setLastRawScan] = useState<string | null>(null);

  const [isCameraDialogOpen, setIsCameraDialogOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const photoVideoRef = useRef<HTMLVideoElement>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);

  const [manualConnote, setManualConnote] = useState('');
  const [manualCarrier, setManualCarrier] = useState('');
  const [manualAddress, setManualAddress] = useState('');

  const scanQRCode = useCallback(() => {
    if (isScannerPaused) {
      if (animationFrameId.current) {
        animationFrameId.current = requestAnimationFrame(scanQRCode);
      }
      return;
    }

    if (
      videoRef.current &&
      videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA &&
      canvasRef.current
    ) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );
        const code = jsqr(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          setLastRawScan(code.data);
          const parsedData = parseScannedData(code.data);

          if (parsedData) {
            setStops(prev => {
              const alreadyExists = prev.some(stop =>
                stop.description.includes(parsedData.consignmentNumber)
              );
              if (alreadyExists) {
                setTimeout(() => {
                  toast({
                    title: 'Duplicate',
                    description: `Stop for ${parsedData.consignmentNumber} already exists.`,
                    variant: 'default',
                  });
                }, 0);
                return prev;
              }

              setTimeout(() => {
                toast({
                  title: 'Stop Added',
                  description: `Scanned and added ${parsedData.name} (${parsedData.consignmentNumber}).`,
                });
              }, 0);

              return [
                ...prev,
                {
                  type: 'Standard',
                  address: parsedData.address,
                  description: `${parsedData.name} - ${parsedData.consignmentNumber}`,
                },
              ];
            });

            if (animationFrameId.current)
              cancelAnimationFrame(animationFrameId.current);

            setTimeout(() => {
              if (animationFrameId.current !== undefined) {
                animationFrameId.current = requestAnimationFrame(scanQRCode);
              }
            }, 3000);
            return;
          } else {
            setTimeout(() => {
              toast({
                title: 'Scan Failed',
                description:
                  'Could not parse required details from QR code.',
                variant: 'destructive',
              });
            }, 0);
          }
        }
      }
    }
    if (animationFrameId.current !== undefined) {
      animationFrameId.current = requestAnimationFrame(scanQRCode);
    }
  }, [isScannerPaused, toast]);

  const stopScanner = useCallback(() => {
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

  const startScanner = useCallback(async () => {
    if (animationFrameId.current || isCameraDialogOpen) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCameraPermission(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: 'environment'},
      });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn('QR Scanner play was interrupted.'));
        animationFrameId.current = requestAnimationFrame(scanQRCode);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
    }
  }, [scanQRCode, isCameraDialogOpen]);

  useEffect(() => {
    if (!isCameraDialogOpen) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [isCameraDialogOpen, startScanner, stopScanner]);

  const handleManualAdd = () => {
    if (!manualConnote.trim() || !manualAddress.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide at least a connote and address.',
        variant: 'destructive',
      });
      return;
    }
    setStops(prev => [
      ...prev,
      {
        type: 'Standard',
        address: manualAddress,
        description: manualConnote,
      },
    ]);
    setManualConnote('');
    setManualCarrier('');
    setManualAddress('');
    toast({title: 'Stop Added', description: `Manually added ${manualConnote}.`});
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
      toast({title: 'Canvas Error', variant: 'destructive'});
      setIsCapturing(false);
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUri = canvas.toDataURL('image/jpeg');

    try {
      const {details} = await extractConnoteDetails({photoDataUri: dataUri});
      setManualConnote(details.consignmentNumber);
      setManualCarrier(details.carrier);
      setManualAddress(details.address);
      toast({title: 'Details Extracted'});
      setIsCameraDialogOpen(false);
    } catch (error) {
      toast({title: 'Extraction Failed', variant: 'destructive'});
    } finally {
      setIsCapturing(false);
    }
  };

  useEffect(() => {
    if (isCameraDialogOpen) {
      navigator.mediaDevices
        .getUserMedia({video: {facingMode: 'environment'}})
        .then(stream => {
          if (photoVideoRef.current) {
            photoVideoRef.current.srcObject = stream;
            photoVideoRef.current
              .play()
              .catch(e => console.error('Error playing photo video stream:', e));
          }
        })
        .catch(err => {
          toast({title: 'Camera Error', variant: 'destructive'});
        });
    } else {
      if (photoVideoRef.current && photoVideoRef.current.srcObject) {
        const stream = photoVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        photoVideoRef.current.srcObject = null;
      }
    }
  }, [isCameraDialogOpen, toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const file = event.target.files[0];
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, {type: 'binary'});
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet, {header: 1});

        const newAddresses = json
          .slice(1)
          .map((row: any, index: number) => ({
            type: 'Standard' as const,
            address: row[0],
            description: `Stop ${index + 1}`,
          }))
          .filter(stop => stop.address && stop.address.trim() !== '');

        if (newAddresses.length === 0) {
          toast({
            title: 'File Error',
            description: 'No addresses found.',
            variant: 'destructive',
          });
          return;
        }

        setStops(prev => [...prev, ...newAddresses]);
        toast({title: 'File Loaded', description: `${newAddresses.length} stops loaded.`});
      } catch (error) {
        toast({title: 'File Read Error', variant: 'destructive'});
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleGenerateRoute = async () => {
    if (!startLocation.trim()) {
      toast({title: 'Missing Start Location', variant: 'destructive'});
      return;
    }
    if (stops.length === 0 && timeSensitiveStops.length === 0) {
      toast({title: 'No Stops Provided', variant: 'destructive'});
      return;
    }

    setIsLoading(true);
    setRoutePlan(null);

    try {
      const timeSensitiveForInput = timeSensitiveStops
        .filter(ts => ts.address.trim() !== '')
        .map(ts => ({
          type: 'Time Sensitive' as const,
          address: ts.address,
          description: `Deliver by ${ts.time}`,
        }));

      const standardStopsForInput = stops.map(stop => ({
        type: stop.type,
        address: stop.address,
        description: stop.description,
      }));

      const routeInput: RoutePlannerInput = {
        startLocation,
        stops: [...timeSensitiveForInput, ...standardStopsForInput],
      };

      const {summary, usage} = await planRoute(routeInput);
      addTokens(usage.totalTokens);
      setRoutePlan(summary);
      toast({title: 'Route Optimized!', description: 'AI has generated a plan.'});
    } catch (error) {
      console.error('Error generating route:', error);
      toast({
        title: 'Could not Generate route plan',
        description:
          error instanceof Error ? error.message : 'An unknown error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleExportCsv = () => {
    if (!routePlan || routePlan.optimizedRoute.length === 0) {
      toast({ title: "No Route Data", description: "Please generate a route first.", variant: "destructive" });
      return;
    }

    let csvContent = "Address,Description,Type\n";
    routePlan.optimizedRoute.forEach(stop => {
      const row = `"${stop.address.replace(/"/g, '""')}","${stop.description.replace(/"/g, '""')}","${stop.type}"`;
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `delivery_route.csv`);
    link.style.visibility = 'hidden';
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

  const handleAddTimeSensitive = () => {
    setTimeSensitiveStops(prev => [
      ...prev,
      {id: `ts-${Date.now()}`, address: '', time: '', status: 'pending'},
    ]);
  };

  const handleRemoveTimeSensitive = (id: string) => {
    setTimeSensitiveStops(prev => prev.filter(item => item.id !== id));
  };

  const handleTimeSensitiveChange = (
    id: string,
    field: 'address' | 'time',
    value: string
  ) => {
    setTimeSensitiveStops(prev =>
      prev.map(item => (item.id === id ? {...item, [field]: value} : item))
    );
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <RouteIcon className="mr-2 h-7 w-7 text-primary" /> Multi-Stop
            Route Planner
          </CardTitle>
          <CardDescription>
            Use the QR scanner, manual entry, or file upload to build your stop
            list, then generate an optimized route.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <QrCode className="mr-2 h-5 w-5" />
                Scan Stops
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center overflow-hidden relative">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 bg-black/30 text-white hover:bg-black/50 hover:text-white"
                  onClick={() => setIsScannerPaused(prev => !prev)}
                >
                  {isScannerPaused ? (
                    <Play className="h-5 w-5" />
                  ) : (
                    <Pause className="h-5 w-5" />
                  )}
                  <span className="sr-only">
                    {isScannerPaused ? 'Play Scanner' : 'Pause Scanner'}
                  </span>
                </Button>
              </div>
              {hasCameraPermission === false && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Camera Access Required</AlertTitle>
                  <AlertDescription>
                    Enable camera permissions to use the scanner.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileJson className="mr-2 h-5 w-5" />
                Last Scanned Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lastRawScan ? (
                <pre className="p-2 bg-muted rounded-md text-xs whitespace-pre-wrap h-24 overflow-y-auto">
                  {lastRawScan}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Scan a QR code to see the raw data here.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add Stop Manually
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCameraDialogOpen(true)}
                className="mt-2"
              >
                <Camera className="mr-2 h-4 w-4" /> Scan Note with Camera
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="manual-connote">Connote #</Label>
                  <Input
                    id="manual-connote"
                    value={manualConnote}
                    onChange={e => setManualConnote(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual-carrier">Carrier</Label>
                  <Input
                    id="manual-carrier"
                    value={manualCarrier}
                    onChange={e => setManualCarrier(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="manual-address">Address</Label>
                <Input
                  id="manual-address"
                  value={manualAddress}
                  onChange={e => setManualAddress(e.target.value)}
                />
              </div>
              <Button onClick={handleManualAdd}>Add Stop</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <UploadCloud className="mr-2 h-5 w-5" />
                Upload from File
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="address-file">
                Upload Standard Stops (XLSX/CSV)
              </Label>
              <Input
                id="address-file"
                type="file"
                accept=".xlsx, .csv"
                onChange={handleFileChange}
              />
              {fileName && (
                <p className="text-xs text-muted-foreground">
                  Loaded: {fileName}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Run Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="start-location"
                  className="flex items-center"
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  Start / Depot Address
                </Label>
                <Input
                  id="start-location"
                  value={startLocation}
                  onChange={e => setStartLocation(e.target.value)}
                />
              </div>
              <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <h3 className="font-semibold text-orange-900">
                    Time Sensitive Deliveries
                  </h3>
                </div>
                <div className="space-y-2">
                  {timeSensitiveStops.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-end gap-2 p-2 bg-white rounded-md shadow-sm border border-orange-100"
                    >
                      <div className="flex-grow space-y-1">
                        <Label
                          htmlFor={`ts-addr-${index}`}
                          className="text-xs"
                        >
                          Address
                        </Label>
                        <Input
                          id={`ts-addr-${index}`}
                          value={item.address}
                          onChange={e =>
                            handleTimeSensitiveChange(
                              item.id,
                              'address',
                              e.target.value
                            )
                          }
                          placeholder="e.g. 123 St Georges Tce"
                        />
                      </div>
                      <div className="w-32 space-y-1">
                        <Label
                          htmlFor={`ts-time-${index}`}
                          className="text-xs"
                        >
                          Time
                        </Label>
                        <Input
                          id={`ts-time-${index}`}
                          type="time"
                          value={item.time}
                          onChange={e =>
                            handleTimeSensitiveChange(
                              item.id,
                              'time',
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTimeSensitive(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleAddTimeSensitive}
                  variant="outline"
                  size="sm"
                  className="mt-4 bg-orange-100 border-orange-300 text-orange-800 hover:bg-orange-200"
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Timed Stop
                </Button>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center">
                  <Truck className="mr-2 h-5 w-5" />
                  Standard Stops ({stops.length})
                </h4>
                <div className="max-h-60 overflow-y-auto pr-2">
                  {stops.length > 0 ? (
                    stops.map((stop, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 border rounded-md mb-2"
                      >
                        <span>
                          {stop.description}: {stop.address}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setStops(prev => prev.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No standard stops added.
                    </p>
                  )}
                </div>
              </div>
              <Button
                onClick={handleGenerateRoute}
                disabled={
                  isLoading ||
                  (stops.length === 0 && timeSensitiveStops.length === 0)
                }
                className="w-full text-lg py-3"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-5 w-5" />
                )}
                Generate Optimized Route
              </Button>
            </CardContent>
          </Card>

          {routePlan && (
            <Card>
              <CardHeader>
                <CardTitle>Optimized Route Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-md space-y-2 text-sm">
                  <div className="flex justify-between">
                    <strong>Optimized Stops:</strong>{' '}
                    <span>{routePlan.optimizedRoute.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <strong>Estimated Time:</strong>{' '}
                    <span>{routePlan.estimatedTime}</span>
                  </div>
                </div>
                {routePlan.potentialRisks.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-destructive flex items-center">
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Potential Risks
                    </h4>
                    <ul className="list-disc list-inside text-sm text-destructive/90 mt-1">
                      {routePlan.potentialRisks.map((risk, i) => (
                        <li key={i}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <h4 className="font-semibold flex items-center">
                  <List className="mr-2 h-4 w-4" />
                  Optimized Stop Order
                </h4>
                <div className="border rounded-md max-h-[60vh] overflow-y-auto">
                  <ol className="list-decimal list-inside p-4 space-y-2">
                    {routePlan.optimizedRoute.map((stop, index) => (
                      <li key={index} className="p-2 bg-background rounded-md">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{stop.address}</span>
                          <Button asChild variant="ghost" size="icon">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                stop.address
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground ml-5">
                          {stop.description}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
                 <div className="flex flex-col sm:flex-row gap-2">
                    {routePlan.routeSegments && routePlan.routeSegments.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                        {routePlan.routeSegments.map((segmentUrl, index) => (
                        <Button key={index} asChild className="w-full">
                            <a href={segmentUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Route Part {index + 1}
                            </a>
                        </Button>
                        ))}
                    </div>
                    ) : (
                    <Button asChild className="w-full flex-1">
                        <a href={routePlan.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" /> Open Full Route in Maps
                        </a>
                    </Button>
                    )}
                    <Button onClick={handleExportCsv} variant="outline" className="w-full flex-1">
                        <Download className="mr-2 h-4 w-4" /> Export for My Maps
                    </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Dialog open={isCameraDialogOpen} onOpenChange={setIsCameraDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan Consignment Note</DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center overflow-hidden relative">
            <video
              ref={photoVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            <canvas ref={photoCanvasRef} className="hidden" />
          </div>
          <DialogFooter>
            <Button onClick={handleCaptureAndExtract} disabled={isCapturing}>
              {isCapturing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              Capture & Extract Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
