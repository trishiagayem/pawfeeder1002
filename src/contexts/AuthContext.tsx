import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

interface AdminProfile {
  uid: string;
  email: string;
  name: string;
  bio?: string;
  role: 'admin' | 'main';
  status: 'pending' | 'approved' | 'declined';
  managingLocation: string;
}

interface AuthContextType {
  currentUser: User | null;
  adminProfile: AdminProfile | null;
  loading: boolean;
  isViewer: boolean;
  setViewerMode: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isViewer, setIsViewer] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      
      if (user) {
        setIsViewer(false);
        // Listen to the admin profile in Firestore
        unsubscribeProfile = onSnapshot(doc(db, 'admins', user.uid), async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as AdminProfile;
            // Self-healing: Ensure main admin always has correct role and status
            if (user.email === 'trishiagayem18@gmail.com' && (data.role !== 'main' || data.status !== 'approved')) {
              try {
                await setDoc(doc(db, 'admins', user.uid), {
                  ...data,
                  role: 'main',
                  status: 'approved'
                }, { merge: true });
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, `admins/${user.uid}`);
              }
            }
            setAdminProfile(data);
          } else {
            // If it's the owner email, auto-create the main admin profile
            if (user.email === 'trishiagayem18@gmail.com') {
              const mainProfile: AdminProfile = {
                uid: user.uid,
                email: user.email!,
                name: 'Main Admin',
                role: 'main',
                status: 'approved',
                managingLocation: 'Over All'
              };
              try {
                await setDoc(doc(db, 'admins', user.uid), mainProfile);
                setAdminProfile(mainProfile);
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, `admins/${user.uid}`);
              }
            } else {
              setAdminProfile(null);
            }
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `admins/${user.uid}`);
          setLoading(false);
        });
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        setAdminProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const value = {
    currentUser,
    adminProfile,
    loading,
    isViewer,
    setViewerMode: setIsViewer
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
