'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useRef
} from 'react';
import { onIdTokenChanged, type User, getIdTokenResult } from 'firebase/auth';
import type { UserRole, UserProfile, Company } from '@/lib/types';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getFirebaseInstances } from '../firebase-init';

export interface Alarm {
  id: string;
  message: string;
  time: Date;
  recurrence: 'none' | 'daily' | 'weekly';
  recurrenceDays?: number[];
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  company: Company | null;
  role: UserRole | null;
  actualRole: UserRole | null;
  isSuperadmin: boolean;
  isOrgAdmin: boolean;
  loading: boolean;
  error: Error | null;
  alarms: Alarm[];
  setAlarms: React.Dispatch<React.SetStateAction<Alarm[]>>;
  removeAlarm: (id: string) => void;
  snoozeAlarm: (id: string, minutes: number) => void;
  rebookAlarm: (id: string) => void;
  nextAlarm: Alarm | null;
  viewAsCompanyId: string | null;
  setViewAsCompanyId: (id: string | null) => void;
  viewAsRole: UserRole | null;
  setViewAsRole: (role: UserRole | null) => void;
  switchActiveCompany: (companyId: string) => Promise<void>;
  tokenCompanyId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUPERADMIN_EMAILS = [
  "benjamin.mackie@teamglobalexp.com",
  "bjmack22277@gmail.com",
  "1@1.com",
  "urika@urika.com.au"
];

/**
 * Enterprise Auth Provider with Identity-Locked listeners (v55.3.0).
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [actualRole, setActualRole] = useState<UserRole | null>(null);
  const [tokenCompanyId, setTokenCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [viewAsCompanyId, setViewAsCompanyId] = useState<string | null>(null);
  const [viewAsRole, setViewAsRole] = useState<UserRole | null>(null);
  
  // Safety fallback for initialization hangs
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.warn("[Auth] Initialization is taking longer than 4s. Forcing loading to false.");
        setLoading(false);
      }, 4000);
      return () => clearTimeout(timer);
    } else {
        console.log("[Auth] Loading state resolved to false.");
    }
  }, [loading]);

  // Ref guard prevents stale listeners from previous sessions (v55.3.0)
  const activeUidRef = useRef<string | null>(null);

  const firebase = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getFirebaseInstances();
  }, []);

  // 1. Auth State Observer
  useEffect(() => {
    if (!firebase?.auth) {
        console.log("[Auth] Firebase Auth instance not yet available.");
        return;
    }
    
    console.log("[Auth] Starting Auth State Observer...");
    return onIdTokenChanged(firebase.auth, async (authUser) => {
      const uid = authUser?.uid || null;
      activeUidRef.current = uid;
      setUser(authUser);
      console.log("[Auth] ID Token Changed. UID:", uid);

      if (!authUser) {
        setProfile(null); 
        setCompany(null); 
        setActualRole(null); 
        setTokenCompanyId(null);
        setLoading(false); 
        return;
      }

      try {
        const tokenResult = await getIdTokenResult(authUser);
        if (activeUidRef.current === uid) {
          const role = tokenResult.claims.role as UserRole || 'user';
          const companyId = tokenResult.claims.companyId as string || null;
          console.log(`[Auth] Custom claims resolved: role=${role}, companyId=${companyId}`);
          setActualRole(role);
          setTokenCompanyId(companyId);
        }
      } catch (err) {
        console.error("[Auth] Token resolution failed", err);
      }
    });
  }, [firebase]);

  // 2. Profile Listener
  useEffect(() => {
    if (!firebase?.firestore || !user) {
      if (!user) {
          console.log("[Auth] No user, setting loading to false in Effect #2.");
          setLoading(false);
      } else {
          console.log("[Auth] Firestore not yet available for Profile Listener.");
      }
      return;
    }

    const currentUid = user.uid;
    console.log("[Auth] Starting Profile Listener for UID:", currentUid);
    const profileRef = doc(firebase.firestore, 'users', currentUid);
    
    // Fail-safe for profile listener: if it doesn't fire, don't hang forever
    const profileTimeout = setTimeout(() => {
        if (loading) {
            console.warn("[Auth] Profile listener timed out after 5s.");
            setLoading(false);
        }
    }, 5000);

    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      clearTimeout(profileTimeout);
      if (activeUidRef.current !== currentUid) {
          console.log("[Auth] Stale Profile Listener callback ignored.");
          return;
      }

      console.log("[Auth] Profile Document Snapshot received. Exists:", docSnap.exists());
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfile(data);
        
        getIdTokenResult(user).then(async (t) => {
          if (activeUidRef.current === currentUid && (!t.claims.companyId || t.claims.role !== data.role)) {
            console.log("[Auth] Token/Profile mismatch detected. Refreshing token...");
            await user.getIdTokenResult(true);
          }
        }).finally(() => {
            console.log("[Auth] Profile resolution complete.");
            setLoading(false);
        });
      } else {
        console.warn("[Auth] Profile document does not exist for UID:", currentUid);
        setLoading(false);
      }
    }, (err) => {
      console.error("[Auth] Profile listener failed", err);
      clearTimeout(profileTimeout);
      if (activeUidRef.current === currentUid) setLoading(false);
    });

    return () => {
        unsubscribe();
        clearTimeout(profileTimeout);
    };
  }, [firebase, user]);

  // 3. Company Listener
  useEffect(() => {
    if (!firebase?.firestore || !profile?.companyId || !user) {
      setCompany(null); 
      return;
    }
    
    const currentUid = user.uid;
    const targetId = (actualRole === 'superadmin' && viewAsCompanyId) ? viewAsCompanyId : profile.companyId;
    if (!targetId) return;

    const unsubscribe = onSnapshot(doc(firebase.firestore, 'companies', targetId), (snap) => {
      if (activeUidRef.current !== currentUid) return;

      if (snap.exists()) {
        setCompany(snap.data() as Company);
      } else {
        setCompany(null);
      }
    }, (err) => {
      console.error("[Auth] Company listener failed", err);
      if (activeUidRef.current === currentUid) setCompany(null);
    });

    return () => unsubscribe();
  }, [firebase, profile?.companyId, viewAsCompanyId, actualRole, user]);

  const switchActiveCompany = async (companyId: string) => {
    if (!user || !profile || !firebase?.firestore) return;
    await updateDoc(doc(firebase.firestore, 'users', user.uid), { companyId });
  };

  const value = {
    user, profile, company, role: viewAsRole || actualRole, actualRole, loading, error,
    alarms, setAlarms, removeAlarm: (id: string) => setAlarms(p => p.filter(a => a.id !== id)),
    snoozeAlarm: (id: string, mins: number) => setAlarms(p => p.map(a => a.id === id ? { ...a, time: new Date(Date.now() + mins * 60000) } : a)),
    rebookAlarm: (id: string) => setAlarms(p => p.map(a => a.id === id ? { ...a, time: new Date(Date.now() + 86400000) } : a)),
    nextAlarm: alarms.length ? [...alarms].sort((a,b) => a.time.getTime() - b.time.getTime())[0] : null,
    isSuperadmin: !!(actualRole === 'superadmin' || (user?.email && SUPERADMIN_EMAILS.includes(user.email))),
    isOrgAdmin: actualRole === 'admin',
    viewAsCompanyId, setViewAsCompanyId, viewAsRole, setViewAsRole, switchActiveCompany, tokenCompanyId
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within AuthProvider');
  return context;
};