"use client";

import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ImpactLevel = 'High' | 'Medium' | 'Low' | 'Unknown';

interface ContactRow {
  id: string;
  customerContact: string;
  jobRole: string;
  impact: ImpactLevel;
  tgeContacts: string;
}

export default function BuildingRelationships() {
  const [rows, setRows] = useState<ContactRow[]>([
    { id: `contact-${Date.now()}`, customerContact: '', jobRole: '', impact: 'Unknown', tgeContacts: '' }
  ]);

  const handleInputChange = (id: string, field: keyof Omit<ContactRow, 'id' | 'impact'>, value: string) => {
    setRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
  };
  
  const handleImpactChange = (id: string, value: ImpactLevel) => {
    setRows(prev => prev.map(row => row.id === id ? { ...row, impact: value } : row));
  };

  const handleAddRow = () => {
    setRows(prev => [...prev, { id: `contact-${Date.now()}`, customerContact: '', jobRole: '', impact: 'Unknown', tgeContacts: '' }]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length > 1) {
        setRows(prev => prev.filter(row => row.id !== id));
    }
  };

  return (
    <div className="p-4 my-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Building Relationships</h3>
      <div className="space-y-1 text-sm text-muted-foreground mb-4">
          <p>• Who do we connect and build relationships with within our prospect/customer base?</p>
          <p>• Where are the gaps?</p>
          <p>• Who else within TGE has relationships with the customer?</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Customer Contact</TableHead>
                    <TableHead>Job Role</TableHead>
                    <TableHead>Impact on Decision</TableHead>
                    <TableHead>TGE Contacts</TableHead>
                    <TableHead className="w-[50px]"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map(row => (
                    <TableRow key={row.id}>
                        <TableCell>
                            <Input 
                                value={row.customerContact}
                                onChange={(e) => handleInputChange(row.id, 'customerContact', e.target.value)}
                                placeholder="e.g., Jane Smith"
                                className="h-8"
                            />
                        </TableCell>
                         <TableCell>
                            <Input 
                                value={row.jobRole}
                                onChange={(e) => handleInputChange(row.id, 'jobRole', e.target.value)}
                                placeholder="e.g., Logistics Manager"
                                className="h-8"
                            />
                        </TableCell>
                         <TableCell>
                             <Select value={row.impact} onValueChange={(value) => handleImpactChange(row.id, value as ImpactLevel)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select Impact" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="High">High</SelectItem>
                                    <SelectItem value="Medium">Medium</SelectItem>
                                    <SelectItem value="Low">Low</SelectItem>
                                    <SelectItem value="Unknown">Unknown</SelectItem>
                                </SelectContent>
                            </Select>
                        </TableCell>
                         <TableCell>
                            <Input 
                                value={row.tgeContacts}
                                onChange={(e) => handleInputChange(row.id, 'tgeContacts', e.target.value)}
                                placeholder="e.g., John Doe (Sales)"
                                className="h-8"
                            />
                        </TableCell>
                        <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveRow(row.id)} disabled={rows.length <= 1} aria-label="Remove Contact Row">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
      </div>
      <Button onClick={handleAddRow} variant="outline" size="sm" className="mt-4">
        <PlusCircle className="mr-2 h-4 w-4" /> Add Contact
      </Button>
      <p className="text-xs text-muted-foreground mt-4">We recognise that in a prospect/new business call this will rely on your research (Google, ChatGPT, LinkedIn etc.)</p>
    </div>
  );
}
