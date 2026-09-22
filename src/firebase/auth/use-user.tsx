'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useRef,
  useCallback
} from 'react';
import { onIdTokenChanged, type User, getIdTokenResult } from 'firebase/auth';
import type { UserRole, UserProfile, Company } from '@/lib/types';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
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
  
  const syncInProgressRef = useRef<boolean>(false);
  const profileUnsubscribeRef = useRef<(() => void) | null>(null);
  const companyUnsubscribeRef = useRef<(() => void) | null>(null);

  const firebase = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getFirebaseInstances();
  }, []);

  const cleanupListeners = useCallback(() => {
    if (profileUnsubscribeRef.current) { profileUnsubscribeRef.current(); profileUnsubscribeRef.current = null; }
    if (companyUnsubscribeRef.current) { companyUnsubscribeRef.current(); companyUnsubscribeRef.current = null; }
  }, []);

  useEffect(() => {
    // Safety valve: Ensure loading always eventually finishes (e.g. after 8s)
    // to prevent getting stuck on the startup spinner if Firebase fails to initialize.
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("[Auth] Initialization safety timeout reached. Forcing loading to false.");
        setLoading(false);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!firebase?.auth || !firebase?.firestore) return;
    const { auth, firestore } = firebase;

    const unsubscribeAuth = onIdTokenChanged(auth, async (authUser) => {
      cleanupListeners();
      setUser(authUser);
      
      if (!authUser) {
        setProfile(null); setCompany(null); setActualRole(null); setTokenCompanyId(null);
        setLoading(false); return;
      }

      try {
        const initialToken = await getIdTokenResult(authUser);
        let currentRole = initialToken.claims.role as UserRole || 'user';
        if (SUPERADMIN_EMAILS.includes(authUser.email || '')) currentRole = 'superadmin';

        setActualRole(currentRole);
        setTokenCompanyId(initialToken.claims.companyId as string || null);

        const profileRef = doc(firestore, 'users', authUser.uid);
        
        // CLEANUP: Ensure any existing listener is terminated before starting a new one
        if (profileUnsubscribeRef.current) {
          profileUnsubscribeRef.current();
          profileUnsubscribeRef.current = null;
        }

        profileUnsubscribeRef.current = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            setProfile(profileData);
            
            getIdTokenResult(authUser).then(async (currentToken) => {
              const tokenCid = currentToken.claims.companyId as string;
              const tokenRole = currentToken.claims.role as UserRole;
              const needsSync = !tokenCid || tokenRole !== profileData.role || tokenCid !== profileData.companyId;

              if (needsSync && !syncInProgressRef.current) {
                syncInProgressRef.current = true;
                const refreshedToken = await authUser.getIdTokenResult(true);
                setActualRole(refreshedToken.claims.role as UserRole || (SUPERADMIN_EMAILS.includes(authUser.email || '') ? 'superadmin' : 'user'));
                setTokenCompanyId(refreshedToken.claims.companyId as string || null);
                syncInProgressRef.current = false;
                setLoading(false);
              } else {
                setActualRole(profileData.role);
                setTokenCompanyId(profileData.companyId);
                setLoading(false);
              }
            }).catch(() => setLoading(false));
          } else if (!syncInProgressRef.current) {
              syncInProgressRef.current = true;
              setDoc(profileRef, { id: authUser.uid, email: authUser.email, name: authUser.displayName || 'User', role: currentRole, companyId: 'easy-as', tokens: 50000, subscriptionStatus: 'active' }, { merge: true })
                .then(() => { syncInProgressRef.current = false; setLoading(false); });
          } else setLoading(false);
        }, () => setLoading(false));
      } catch (err) { setLoading(false); }
    });

    return () => unsubscribeAuth();
  }, [firebase, cleanupListeners]);

  useEffect(() => {
    if (!firebase?.firestore || !user || !profile?.companyId) {
      if (companyUnsubscribeRef.current) { companyUnsubscribeRef.current(); companyUnsubscribeRef.current = null; }
      setCompany(null); return;
    }
    const targetCompanyId = (actualRole === 'superadmin' && viewAsCompanyId) ? viewAsCompanyId : profile?.companyId;
    if (!targetCompanyId) { setCompany(null); return; }
    if (companyUnsubscribeRef.current) {
      companyUnsubscribeRef.current();
      companyUnsubscribeRef.current = null;
    }
    companyUnsubscribeRef.current = onSnapshot(doc(firebase.firestore, 'companies', targetCompanyId), (snap) => {
      if (snap.exists()) setCompany(snap.data() as Company); else setCompany(null);
    }, () => setCompany(null));
  }, [firebase, user, profile?.companyId, viewAsCompanyId, actualRole]);

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
