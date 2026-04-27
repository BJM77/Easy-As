
"use client";

import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Status = 'used' | 'opportunity' | 'none';

interface CellData {
  share: number | string;
  value: number | string;
  status: Status;
}

interface CustomerRow {
  id: string;
  name: string;
  cells: Record<string, CellData>;
}

const services = [
  "Same Day Courier",
  "Road Freight",
  "Pallet Express",
  "Multi Modal",
  "International Logistics",
  "Specialist & Business Services"
];

const initialCellData: CellData = { share: '', value: '', status: 'none' };

const formatCurrency = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};


export default function WhiteSpaceAnalysis() {
  const [rows, setRows] = useState<CustomerRow[]>([
    {
      id: 'initial-1',
      name: 'ABC Customer',
      cells: {
        "Same Day Courier": { share: 50, value: 500000, status: 'used' },
        "Road Freight": { share: 20, value: 850000, status: 'used' },
        "Pallet Express": { share: 50, value: 1000000, status: 'used' },
        "Multi Modal": { share: '', value: 750000, status: 'opportunity' },
        "International Logistics": { share: '', value: '', status: 'none' },
        "Specialist & Business Services": { share: '', value: '', status: 'none' }
      }
    }
  ]);

  const handleAddRow = () => {
    setRows(prev => [...prev, {
      id: `customer-${Date.now()}`,
      name: '',
      cells: services.reduce((acc, service) => ({ ...acc, [service]: { ...initialCellData } }), {})
    }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(prev => prev.filter(row => row.id !== id));
  };
  
  const handleInputChange = (id: string, field: 'name' | 'share' | 'value', value: string, service?: string) => {
    setRows(prev => prev.map(row => {
        if (row.id !== id) return row;

        if (field === 'name') {
            return { ...row, name: value };
        }
        
        if (service) {
          const updatedCells = { ...row.cells };
          const currentCell = updatedCells[service] || { ...initialCellData };
          if(field === 'share' || field === 'value') {
              const numericValue = value.replace(/[^0-9.]/g, '');
              updatedCells[service] = { ...currentCell, [field]: numericValue };
          }
          return { ...row, cells: updatedCells };
        }
        return row;
    }));
  };

  const handleStatusChange = (id: string, service: string, status: Status) => {
    setRows(prev => prev.map(row => {
        if (row.id === id) {
            const updatedCells = { ...row.cells };
            const currentCell = updatedCells[service] || { ...initialCellData };
            updatedCells[service] = { ...currentCell, status };
            return { ...row, cells: updatedCells };
        }
        return row;
    }));
  };
  
  const totals = useMemo(() => {
    const calculatedTotals = services.reduce((acc, service) => {
        acc[service] = { current: 0, total: 0 };
        return acc;
    }, {} as Record<string, { current: number; total: number; }>);

    rows.forEach(row => {
        services.forEach(service => {
            const cell = row.cells[service];
            if (!cell) return;
            
            const valueNum = typeof cell.value === 'string' ? parseFloat(cell.value) : cell.value;
            if (isNaN(valueNum)) return;
            
            if (cell.status === 'used') {
                calculatedTotals[service].current += valueNum;

                const shareNum = typeof cell.share === 'string' ? parseFloat(cell.share) : cell.share;
                if (!isNaN(shareNum) && shareNum > 0 && shareNum < 100) {
                    calculatedTotals[service].total += (valueNum / shareNum) * 100;
                } else {
                    calculatedTotals[service].total += valueNum;
                }
            } else if (cell.status === 'opportunity') {
                calculatedTotals[service].total += valueNum;
            }
        });
    });

    const opportunityTotals = services.reduce((acc, service) => {
      acc[service] = calculatedTotals[service].total - calculatedTotals[service].current;
      return acc;
    }, {} as Record<string, number>);

    return {
        currentValueTotals: calculatedTotals,
        opportunityTotals
    };
}, [rows]);

  const getStatusClasses = (status: Status) => {
    switch (status) {
      case 'used': return 'bg-green-100 dark:bg-green-900/30';
      case 'opportunity': return 'bg-red-100 dark:bg-red-900/30';
      default: return 'bg-background';
    }
  };


  return (
    <div className="p-4 my-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Customer Product/Business Unit Analysis (White Space Analysis)</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Customer Name</TableHead>
              {services.map(service => (
                <TableHead key={service} className="min-w-[180px]">{service}</TableHead>
              ))}
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.id}>
                <TableCell>
                  <Input 
                    value={row.name} 
                    onChange={(e) => handleInputChange(row.id, 'name', e.target.value)}
                    placeholder="Enter customer name"
                    className="h-8"
                  />
                </TableCell>
                {services.map(service => {
                  const cell = row.cells[service] || initialCellData;
                  return (
                    <TableCell key={`${row.id}-${service}`} className={cn("p-1 align-top", getStatusClasses(cell.status))}>
                        <div className="space-y-1">
                          <Select value={cell.status} onValueChange={(value) => handleStatusChange(row.id, service, value as Status)}>
                              <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="used">Solution Used</SelectItem>
                                  <SelectItem value="opportunity">Opportunity</SelectItem>
                                  <SelectItem value="none">Will Not Use</SelectItem>
                              </SelectContent>
                          </Select>
                          <div className="flex items-center gap-1">
                            <Input 
                                value={cell.share} 
                                onChange={(e) => handleInputChange(row.id, 'share', e.target.value, service)}
                                placeholder="%"
                                className="w-16 h-7 text-xs"
                            />
                            <Input 
                                value={cell.value} 
                                onChange={(e) => handleInputChange(row.id, 'value', e.target.value, service)}
                                placeholder="$"
                                className="flex-grow h-7 text-xs"
                            />
                          </div>
                        </div>
                    </TableCell>
                  )
                })}
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveRow(row.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
             <TableRow className="bg-muted/50 font-bold">
                <TableCell>CURRENT VALUE</TableCell>
                {services.map(service => (
                    <TableCell key={`current-${service}`} className="text-center align-middle p-2">
                        {formatCurrency(totals.currentValueTotals[service].current)}
                    </TableCell>
                ))}
                <TableCell></TableCell>
            </TableRow>
            <TableRow className="bg-muted/50 font-bold">
                <TableCell>TOTAL VALUE (100%)</TableCell>
                {services.map(service => (
                    <TableCell key={`total-${service}`} className="text-center align-middle p-2">
                        {formatCurrency(totals.currentValueTotals[service].total)}
                    </TableCell>
                ))}
                <TableCell></TableCell>
            </TableRow>
            <TableRow className="bg-red-200/50 dark:bg-red-800/30 font-bold text-red-800 dark:text-red-200">
                <TableCell>OPPORTUNITY</TableCell>
                {services.map(service => (
                  <TableCell key={`opportunity-${service}`} className="text-center align-middle p-2">
                    {formatCurrency(totals.opportunityTotals[service])}
                  </TableCell>
                ))}
                <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <Button onClick={handleAddRow} variant="outline" size="sm" className="mt-4">
        <PlusCircle className="mr-2 h-4 w-4" /> Add Customer
      </Button>
      <p className="text-xs text-muted-foreground mt-4">We recognise that in a prospect/new business call this will rely on your research (Google, ChatGPT, LinkedIn etc.)</p>
    </div>
  );
}
