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
 * Utility to recursively remove undefined and NaN properties from an object.
 * Firestore does not allow 'undefined' or 'NaN' as field values.
 */
function cleanData(data: any): any {
  if (data === null || data === undefined) return null;
  
  if (typeof data === 'number' && isNaN(data)) return null;

  if (Array.isArray(data)) {
    return data.map(v => cleanData(v));
  } 
  
  // Only recurse into plain objects to avoid breaking class instances like Date, FieldValue, or GeoPoint
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
      setDoc(docRef, sanitizedData, options).catch(async (error: any) => {
        if (error?.code === 'permission-denied') {
          errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
              path: docRef.path,
              operation: 'write',
              requestResourceData: sanitizedData,
            })
          )
        } else {
          console.error("[Firestore Sync] setDoc async error:", error);
        }
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
        .catch(async (error: any) => {
          if (error?.code === 'permission-denied') {
            errorEmitter.emit(
              'permission-error',
              new FirestorePermissionError({
                path: colRef.path,
                operation: 'create',
                requestResourceData: sanitizedData,
              })
            )
          } else {
            console.error("[Firestore Sync] addDoc async error:", error);
          }
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
        .catch(async (error: any) => {
          if (error?.code === 'permission-denied') {
            errorEmitter.emit(
              'permission-error',
              new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: sanitizedData,
              })
            )
          } else {
            console.error("[Firestore Sync] updateDoc async error:", error);
          }
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
        .catch(async (error: any) => {
          if (error?.code === 'permission-denied') {
            errorEmitter.emit(
              'permission-error',
              new FirestorePermissionError({
                path: docRef.path,
                operation: 'delete',
              })
            )
          } else {
            console.error("[Firestore Sync] deleteDoc async error:", error);
          }
        });
  } catch (syncErr) {
      console.error("[Firestore Sync] Error during deleteDoc:", syncErr);
  }
}
