"use client";

import React, { useState, useEffect } from 'react';
import type { PostcodeData } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, Download, ClipboardPaste } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SuburbPostcodeConverterProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  allPostcodes: PostcodeData[];
}

interface ConversionResult {
  id: number;
  originalOrigin: string;
  originalDestination: string;
  originResult: PostcodeData | null;
  destinationResult: PostcodeData | null;
  status: 'OK' | 'Origin Not Found' | 'Destination Not Found' | 'Both Not Found';
}

export default function SuburbPostcodeConverter({ isOpen, onOpenChange, allPostcodes }: SuburbPostcodeConverterProps) {
  const [pastedText, setPastedText] = useState('');
  const [results, setResults] = useState<ConversionResult[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setPastedText('');
      setResults([]);
    }
  }, [isOpen]);

  const findPostcode = (suburb: string): PostcodeData | null => {
    if (!suburb || !allPostcodes) return null;
    const searchTerm = suburb.toLowerCase().trim();
    // Prioritize exact match
    const exactMatch = allPostcodes.find(p => p.suburb.toLowerCase() === searchTerm);
    if (exactMatch) return exactMatch;
    // Fallback to partial match if no exact match found
    const partialMatch = allPostcodes.find(p => p.suburb.toLowerCase().includes(searchTerm));
    return partialMatch || null;
  };

  const handleConvert = () => {
    const lines = pastedText.trim().split(/\r\n|\n/).filter(line => line.trim());
    if (lines.length === 0) {
      toast({ title: "No data", description: "Please paste some data to convert.", variant: "destructive" });
      return;
    }

    const conversionResults = lines.map((line, index) => {
      const columns = line.split(/\t|,/); // Split by tab or comma
      const originSuburb = columns[0]?.trim() || '';
      const destSuburb = columns[1]?.trim() || '';

      const originResult = findPostcode(originSuburb);
      const destinationResult = findPostcode(destSuburb);
      
      let status: ConversionResult['status'] = 'OK';
      if (!originResult && !destinationResult) {
        status = 'Both Not Found';
      } else if (!originResult) {
        status = 'Origin Not Found';
      } else if (!destinationResult) {
        status = 'Destination Not Found';
      }

      return {
        id: index,
        originalOrigin: originSuburb,
        originalDestination: destSuburb,
        originResult,
        destinationResult,
        status
      };
    });

    setResults(conversionResults);
    toast({ title: "Conversion Complete", description: `Processed ${conversionResults.length} rows.` });
  };
  
  const handleDownloadCsv = () => {
    if (results.length === 0) {
        toast({ title: "No data to download", description: "Please convert some data first.", variant: "destructive" });
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Origin Suburb,Origin Postcode,Origin State,Destination Suburb,Destination Postcode,Destination State,Status\r\n";

    results.forEach(res => {
        const row = [
            `"${res.originalOrigin.replace(/"/g, '""')}"`,
            res.originResult?.postcode ?? 'N/A',
            res.originResult?.state ?? 'N/A',
            `"${res.originalDestination.replace(/"/g, '""')}"`,
            res.destinationResult?.postcode ?? 'N/A',
            res.destinationResult?.state ?? 'N/A',
            res.status
        ];
        csvContent += row.join(',') + '\r\n';
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "suburb_postcode_conversion.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MapPin className="mr-2 h-5 w-5 text-primary" />
            Bulk Suburb to Postcode Converter
          </DialogTitle>
          <DialogDescription>
            Paste multiple rows of origin and destination suburbs (separated by a tab or comma) to find their postcodes and states.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="suburb-paste-area">Paste Data Here</Label>
            <Textarea
              id="suburb-paste-area"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="e.g.,&#10;Sydney,Melbourne&#10;Perth&#09;Adelaide"
              rows={6}
            />
          </div>
          <Button onClick={handleConvert}><ClipboardPaste className="mr-2 h-4 w-4" />Convert</Button>
          
          {results.length > 0 && (
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-semibold">Conversion Results</h4>
                    <Button onClick={handleDownloadCsv} variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" /> Download CSV
                    </Button>
                </div>
                 <ScrollArea className="h-64 border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Origin Suburb</TableHead>
                                <TableHead>Postcode</TableHead>
                                <TableHead>State</TableHead>
                                <TableHead>Destination Suburb</TableHead>
                                <TableHead>Postcode</TableHead>
                                <TableHead>State</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {results.map((result) => (
                                <TableRow key={result.id} className={result.status !== 'OK' ? 'bg-destructive/10' : ''}>
                                    <TableCell>{result.originalOrigin || <span className="text-muted-foreground">N/A</span>}</TableCell>
                                    <TableCell>{result.originResult?.postcode ?? <span className="text-destructive">Not Found</span>}</TableCell>
                                    <TableCell>{result.originResult?.state ?? 'N/A'}</TableCell>
                                    <TableCell>{result.originalDestination || <span className="text-muted-foreground">N/A</span>}</TableCell>
                                    <TableCell>{result.destinationResult?.postcode ?? <span className="text-destructive">Not Found</span>}</TableCell>
                                    <TableCell>{result.destinationResult?.state ?? 'N/A'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
