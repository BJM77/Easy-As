"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Compass, Video, AlertTriangle, Route, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import jsqr from 'jsqr';
import { Button } from '@/components/ui/button';
import { extractAddress } from '@/lib/address-utils';

type LastScanned = {
  extractedAddress: string;
  extractedName: string;
  connote: string;
  raw: string;
} | null;

const extractInfo = (data: string): { address: string; name: string; connote: string } => {
  if (!data) return { address: '', name: '', connote: '' };

  const raw = data.trim();
  let s = raw.replace(/\r?\n/g, ' ').replace(/[|><\*]/g, ' ').replace(/\s+/g, ' ').trim();

  const connoteMatch = s.match(/\b([A-Z]{4,7}\d{6,})\b/);
  const connote = connoteMatch ? connoteMatch[0] : 'UNKNOWN_CONNOTE';
  if(connoteMatch) {
      s = s.replace(connote, '');
  }

  let name = 'Name Not Found';
  const address = extractAddress(raw);

  return { address, name, connote };
};


export default function FindItPageContent() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const animationFrameId = useRef<number | null>(null);
  const [lastScannedData, setLastScannedData] = useState<LastScanned>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const openGoogleMaps = (address: string) => {
    if (!address) return;
    const destination = encodeURIComponent(address);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    window.open(mapsUrl, '_blank');
  };

  const scanQRCode = useCallback(() => {
    if (animationFrameId.current === null) return;
    if (isProcessing) {
      animationFrameId.current = requestAnimationFrame(scanQRCode);
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

        if (code && code.data) {
          setIsProcessing(true);
          const raw = code.data.trim();
          const { address, name, connote } = extractInfo(raw);

          setLastScannedData({
            extractedAddress: address,
            extractedName: name,
            connote: connote,
            raw,
          });

          toast({
            title: "Code Scanned!",
            description: "Opening Google Maps with extracted address...",
          });

          openGoogleMaps(address);

          setTimeout(() => {
            setIsProcessing(false);
          }, 3000);
        }
      }
    }

    if (animationFrameId.current !== null) {
      animationFrameId.current = requestAnimationFrame(scanQRCode);
    }
  }, [isProcessing, toast]);

  const startScanner = useCallback(async () => {
    if (animationFrameId.current !== null) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCameraPermission(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(e => console.warn("Error playing video stream:", e));
        animationFrameId.current = -1;
        animationFrameId.current = requestAnimationFrame(scanQRCode);
      }
    } catch (error) {
      console.error('Error accessing camera for Find It page:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions in your browser settings to use the scanner.',
      });
    }
  }, [scanQRCode, toast]);

  const stopScanner = useCallback(() => {
    if (animationFrameId.current !== null) {
      if (animationFrameId.current > 0) {
        cancelAnimationFrame(animationFrameId.current);
      }
      animationFrameId.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    animationFrameId.current = null;
    startScanner();
    return () => {
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Compass className="mr-2 h-7 w-7 text-primary" /> Find It
          </CardTitle>
          <CardDescription>
            Point your camera at a QR code containing an address or location URL. Google Maps will automatically open with directions from your current location.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="aspect-video w-full max-w-lg mx-auto bg-muted rounded-lg flex items-center justify-center overflow-hidden relative">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-32 relative border-4 border-white/50 rounded-lg"></div>
                </div>
            </div>
             {hasCameraPermission === false && (
                <Alert variant="destructive" className="mt-4 max-w-lg mx-auto">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Camera Access Required</AlertTitle>
                    <AlertDescription>This feature requires camera access. Please enable it in your browser settings and refresh the page.</AlertDescription>
                </Alert>
            )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center"><MapPin className="mr-2 h-5 w-5"/>Last Scanned Destination</CardTitle>
        </CardHeader>
        <CardContent>
            {lastScannedData ? (
                <div className="space-y-2">
                    <div className="p-4 bg-muted rounded-md font-mono text-sm whitespace-pre-wrap break-all">
                        <strong>Connote:</strong> {lastScannedData.connote}
                        {"\n"}
                        <strong>Extracted Address:</strong> {lastScannedData.extractedAddress}
                        {"\n\n"}
                        <details>
                            <summary className="cursor-pointer text-xs">Show Raw Data</summary>
                            <p className="mt-1">{lastScannedData.raw}</p>
                        </details>
                    </div>
                     <div className="flex gap-2">
                       <Button onClick={() => openGoogleMaps(lastScannedData.extractedAddress)} variant="outline" size="sm">
                          <Route className="mr-2 h-4 w-4" /> Re-open in Google Maps
                       </Button>
                     </div>
                </div>
            ) : (
                <p className="text-muted-foreground text-center py-8">Waiting for scan...</p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
