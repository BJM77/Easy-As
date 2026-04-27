'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * RELIABILITY: Utility to recursively remove undefined and NaN properties from an object.
 * Firestore SDK crashes or behaves unexpectedly when 'undefined' or 'NaN' is passed.
 */
function cleanData(data: any): any {
  if (data === null || data === undefined) return null;
  
  if (typeof data === 'number' && isNaN(data)) return null;

  if (Array.isArray(data)) {
    return data.map(v => cleanData(v));
  } 
  
  if (typeof data === 'object' && data.constructor === Object) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        const cleanedValue = cleanData(value);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
    }
    return cleaned;
  }
  
  return data;
}

/**
 * Initiates a setDoc operation for a document reference.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  const sanitizedData = cleanData(data);
  try {
      setDoc(docRef, sanitizedData, options).catch(async (error) => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: docRef.path,
            operation: 'write',
            requestResourceData: sanitizedData,
          })
        )
      })
  } catch (syncErr) {
      console.error("[Firestore Sync] Error during setDoc:", syncErr);
  }
}


/**
 * Initiates an addDoc operation for a collection reference.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  const sanitizedData = cleanData(data);
  try {
      const promise = addDoc(colRef, sanitizedData)
        .catch(async (error) => {
          errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
              path: colRef.path,
              operation: 'create',
              requestResourceData: sanitizedData,
            })
          )
        });
      return promise;
  } catch (syncErr) {
      console.error("[Firestore Sync] Error during addDoc:", syncErr);
      return Promise.resolve(null);
  }
}


/**
 * Initiates an updateDoc operation for a document reference.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  const sanitizedData = cleanData(data);
  try {
      updateDoc(docRef, sanitizedData)
        .catch(async (error) => {
          errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
              path: docRef.path,
              operation: 'update',
              requestResourceData: sanitizedData,
            })
          )
        });
  } catch (syncErr) {
      console.error("[Firestore Sync] Error during updateDoc:", syncErr);
  }
}


/**
 * Initiates a deleteDoc operation for a document reference.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  try {
      deleteDoc(docRef)
        .catch(async (error) => {
          errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
              path: docRef.path,
              operation: 'delete',
            })
          )
        });
  } catch (syncErr) {
      console.error("[Firestore Sync] Error during deleteDoc:", syncErr);
  }
}