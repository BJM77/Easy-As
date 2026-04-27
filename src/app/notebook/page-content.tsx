"use client";

import React, { useState, useMemo } from 'react';
import { useAuth, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BookOpen, PlusCircle, Search, Trash2, Edit, Save, Clock, Loader2, StickyNote, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import type { Note } from '@/lib/types';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function NotebookPageContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const notesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'notes'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
  }, [firestore, user]);

  const { data: notesData, isLoading } = useCollection<Note>(notesQuery);
  const notes = notesData ?? [];

  const filteredNotes = useMemo(() => {
    if (!Array.isArray(notes)) return [];
    return notes.filter(n => {
      const titleMatch = (n.title || '').toLowerCase().includes(searchQuery.toLowerCase());
      const contentMatch = (n.content || '').toLowerCase().includes(searchQuery.toLowerCase());
      return titleMatch || contentMatch;
    });
  }, [notes, searchQuery]);

  const formatDateSafe = (dateStr: any, formatStr: string) => {
    try {
      if (!dateStr) return 'N/A';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, formatStr);
    } catch (e) {
      return 'N/A';
    }
  };

  const handleStartNewNote = () => {
    setSelectedNote(null);
    setNoteTitle('');
    setNoteContent('');
    setIsEditing(true);
  };

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
    setNoteTitle(note.title || '');
    setNoteContent(note.content || '');
    setIsEditing(false);
  };

  const handleSaveNote = async () => {
    if (!user || !firestore || !noteTitle.trim()) return;
    setIsSubmitting(true);

    try {
      const isNew = !selectedNote;
      const noteId = isNew ? doc(collection(firestore, 'notes')).id : selectedNote.id;
      const noteRef = doc(firestore, 'notes', noteId);

      const payload: Partial<Note> = {
        id: noteId,
        userId: user.uid,
        title: noteTitle.trim(),
        content: noteContent.trim(),
        updatedAt: new Date().toISOString()
      };

      setDocumentNonBlocking(noteRef, payload, { merge: true });
      toast({ title: 'Note Saved', description: isNew ? 'Created new note.' : 'Updated existing note.' });
      setIsEditing(false);
      if (isNew) {
          setSelectedNote(payload as Note);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Could not save note.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!firestore) return;
    try {
      deleteDocumentNonBlocking(doc(firestore, 'notes', id));
      toast({ title: 'Note Deleted' });
      if (selectedNote?.id === id) {
        setSelectedNote(null);
        setIsEditing(false);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Could not delete note.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto h-[calc(100vh-12rem)] flex flex-col">
      <Card className="shadow-xl shrink-0">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="text-2xl font-headline flex items-center">
                <BookOpen className="mr-2 h-7 w-7 text-primary" /> Notebook
              </CardTitle>
              <CardDescription>Your personal repository for freight strategies, client insights, and meeting notes.</CardDescription>
            </div>
            <Button onClick={handleStartNewNote}>
              <PlusCircle className="mr-2 h-4 w-4" /> New Note
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {/* Sidebar: Note List */}
        <Card className="md:col-span-1 flex flex-col overflow-hidden">
          <CardHeader className="py-4 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search notes..." 
                className="pl-8 h-9" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-grow overflow-hidden">
            <ScrollArea className="h-full">
              {isLoading ? (
                <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-primary"/></div>
              ) : filteredNotes.length > 0 ? (
                <div className="divide-y">
                  {filteredNotes.map(note => (
                    <div 
                      key={note.id}
                      onClick={() => handleSelectNote(note)}
                      className={cn(
                        "p-4 cursor-pointer hover:bg-muted/50 transition-colors group",
                        selectedNote?.id === note.id && "bg-primary/5 border-r-2 border-primary"
                      )}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-semibold truncate pr-4">{note.title}</h4>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive p-1 hover:bg-destructive/10 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{note.content}</p>
                      <div className="flex items-center text-[10px] text-muted-foreground font-mono">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDateSafe(note.updatedAt, 'dd MMM yyyy, p')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center text-muted-foreground italic text-sm">No notes found.</div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Content: Note Editor/Viewer */}
        <Card className="md:col-span-2 flex flex-col overflow-hidden">
          {isEditing || (!selectedNote && notes.length === 0) ? (
            <div className="flex flex-col h-full">
              <CardHeader className="border-b">
                <div className="space-y-1">
                  <Label htmlFor="note-title" className="text-xs uppercase tracking-wider font-bold">Title</Label>
                  <Input 
                    id="note-title"
                    value={noteTitle} 
                    onChange={e => setNoteTitle(e.target.value)}
                    placeholder="e.g. Q4 Strategy for Western Logistics"
                    className="text-lg font-semibold border-none focus-visible:ring-0 px-0 h-auto"
                    autoFocus
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-grow">
                <Textarea 
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  placeholder="Start writing your notes here..."
                  className="h-full border-none focus-visible:ring-0 p-6 resize-none text-base leading-relaxed"
                />
              </CardContent>
              <CardFooter className="border-t py-3 bg-muted/30 justify-end gap-2">
                <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={isSubmitting}>Cancel</Button>
                <Button onClick={handleSaveNote} disabled={isSubmitting || !noteTitle.trim()}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Save className="mr-2 h-4 w-4" />}
                  Save Note
                </Button>
              </CardFooter>
            </div>
          ) : selectedNote ? (
            <div className="flex flex-col h-full">
              <CardHeader className="border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl">{selectedNote.title}</CardTitle>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      Last updated {formatDateSafe(selectedNote.updatedAt, 'PPPP p')}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-grow">
                <ScrollArea className="h-full">
                  <div className="p-8 text-base leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {selectedNote.content}
                  </div>
                </ScrollArea>
              </CardContent>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
              <div className="p-6 bg-muted rounded-full">
                <StickyNote className="h-12 w-12 opacity-20" />
              </div>
              <p>Select a note from the list or create a new one.</p>
              <Button variant="outline" onClick={handleStartNewNote}>
                <PlusCircle className="mr-2 h-4 w-4" /> Create First Note
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}