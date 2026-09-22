
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, Video, AlertTriangle, History, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import jsqr from 'jsqr';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function QrScanPageContent() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const animationFrameId = useRef<number>();
  const [scannedDataHistory, setScannedDataHistory] = useState<string[]>([]);
  const [lastScanTime, setLastScanTime] = useState<number>(0);

  const scanQRCode = useCallback(() => {
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
          const now = Date.now();
          if (now - lastScanTime > 3000) { 
            setScannedDataHistory(prevHistory => {
                const newHistory = [code.data, ...prevHistory];
                return newHistory.slice(0, 10);
            });
            setLastScanTime(now);
            toast({
              title: "Code Scanned!",
              description: `Data has been added to the history.`,
            });
          }
        }
      }
    }
    animationFrameId.current = requestAnimationFrame(scanQRCode);
  }, [lastScanTime, toast]);

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
           throw new Error("Camera not supported by this browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
           videoRef.current.play().catch(e => console.error("Error playing video stream:", e));
        }
        animationFrameId.current = requestAnimationFrame(scanQRCode);
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      }
    };

    getCameraPermission();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [scanQRCode, toast]);


  const handleClearHistory = () => {
    setScannedDataHistory([]);
    toast({ title: 'History Cleared' });
  };


  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <QrCode className="mr-2 h-7 w-7 text-primary" /> QR & Barcode Scanner
          </CardTitle>
          <CardDescription>
            Point your camera at a QR code or barcode to display its raw data content below. The last 10 scans are saved for your session.
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
            <div className="flex justify-between items-center">
                <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5"/>Scan History</CardTitle>
                <Button variant="outline" size="sm" onClick={handleClearHistory} disabled={scannedDataHistory.length === 0}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear History
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            {scannedDataHistory.length > 0 ? (
                <div className="space-y-4">
                    <div>
                        <h3 className="font-semibold mb-2">Most Recent Scan</h3>
                        <div className="p-4 bg-muted rounded-md font-mono text-sm whitespace-pre-wrap break-all">
                            {scannedDataHistory[0]}
                        </div>
                    </div>
                    {scannedDataHistory.length > 1 && (
                        <div>
                             <Separator className="my-4" />
                            <h3 className="font-semibold mb-2">Previous Scans</h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {scannedDataHistory.slice(1).map((data, index) => (
                                    <div key={index} className="p-2 bg-background border rounded-md font-mono text-xs whitespace-pre-wrap break-all">
                                       {data}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <p className="text-muted-foreground text-center py-8">Waiting for scan...</p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

    