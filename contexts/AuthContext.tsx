// contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { signIn as authSignIn, signUpWithRole as authSignUpWithRole, signOut as authSignOut, EmailSignUpCredentials, UserProfileData } from '../services/authService';
import { getUserProfile, Profile } from '../services/dbService';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: 'creator' | 'brand' | null;
  loading: boolean; // Renamed from appIsLoading for consistency with original index.tsx
  actionInProgress: boolean; 
  error: string | null;
  signIn: (credentials: Parameters<typeof authSignIn>[0]) => Promise<any>; // Use Parameters for type safety
  signUpWithRole: (credentials: EmailSignUpCredentials, profileData: UserProfileData) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<'creator' | 'brand' | null>(null);
  
  const [initialAuthCheckComplete, setInitialAuthCheckComplete] = useState<boolean>(false);
  const [profileFetchAttempted, setProfileFetchAttempted] = useState<boolean>(false);
  const [profileIsLoading, setProfileIsLoading] = useState<boolean>(false);

  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial check for session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setInitialAuthCheckComplete(true); 
    }).catch(err => {
        console.error("Error in initial getSession:", err);
        setError("Failed to initialize session.");
        setInitialAuthCheckComplete(true); 
    });

    // Auth state change listener
    const { data: authListenerData } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      const newUser = newSession?.user ?? null;
      setUser(newUser);
      setInitialAuthCheckComplete(true); 
      
      if (!newSession || !newUser) { // User logged out or session ended
        setProfile(null);
        setRole(null);
        setProfileFetchAttempted(false); // Reset for next login
        setProfileIsLoading(false);
      } else if (user?.id !== newUser.id) { 
        // New user logged in or different user, reset profile states
        setProfile(null);
        setRole(null);
        setProfileFetchAttempted(false); // Critical to allow refetch for new user
        setProfileIsLoading(false);
      }
    });

    return () => {
      authListenerData?.subscription?.unsubscribe();
    };
  }, [user?.id]); // Rerun if user.id changes (covers user changing without full logout/login cycle if that happens)

  useEffect(() => {
    if (user && initialAuthCheckComplete && !profileFetchAttempted) {
      setProfileIsLoading(true);
      setProfileFetchAttempted(true);
      setError(null);

      getUserProfile(user.id)
        .then(fetchedProfile => {
          if (fetchedProfile) {
            setProfile(fetchedProfile);
            setRole(fetchedProfile.role as 'creator' | 'brand');
          } else {
            console.warn(`Profile not found for user ${user.id}. This is expected if the user just signed up and the profile creation trigger is asynchronous or if there was an issue.`);
            //setError("User profile not found. Please complete profile setup or try logging in again.");
            // Don't set a blocking error here, allow user to proceed to their dashboard to potentially create profile
            setProfile(null); 
            setRole(null);
          }
        })
        .catch(err => {
          console.error("Error fetching user profile:", err);
          setError(err instanceof Error ? err.message : "Failed to load user profile.");
          setProfile(null); 
          setRole(null);
        })
        .finally(() => {
          setProfileIsLoading(false);
        });
    } else if (!user && initialAuthCheckComplete) {
      // If user logs out and initial auth check was complete, clear profile data
      setProfile(null);
      setRole(null);
      setProfileIsLoading(false);
      setProfileFetchAttempted(false); // Reset for next login
    }
  }, [user, initialAuthCheckComplete, profileFetchAttempted]); // profileFetchAttempted ensures it tries once per user session


  const handleSignOut = async () => {
    setActionInProgress(true);
    setError(null);
    try {
      await authSignOut();
      // The onAuthStateChange listener will handle setting user, session, profile, role to null.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign out.');
      console.error("Sign out error:", e);
    } finally {
      setActionInProgress(false);
    }
  };
  
  const wrappedSignIn: AuthContextType['signIn'] = async (credentials) => {
    setActionInProgress(true);
    setError(null);
    try {
      const result = await authSignIn(credentials);
      // onAuthStateChange will handle updates.
      return result; // Return result for form to handle if needed
    } catch (err) {
      const e = err as AuthError; // Supabase errors are AuthError
      setError(e.message || "Sign in failed.");
      throw e; 
    } finally {
      setActionInProgress(false);
    }
  };
  
  const wrappedSignUpWithRole: AuthContextType['signUpWithRole'] = async (credentials, profileData) => {
    setActionInProgress(true);
    setError(null);
    try {
      const result = await authSignUpWithRole(credentials, profileData);
      // onAuthStateChange handles new user, profile fetch will trigger after user is set.
      return result;
    } catch (err) {
      const e = err as AuthError;
      setError(e.message || "Sign up failed.");
      throw e; 
    } finally {
      setActionInProgress(false);
    }
  };

  // This is the loading state for the entire app initialization (auth check + initial profile fetch)
  const appInitialLoading = !initialAuthCheckComplete || profileIsLoading;

  const value: AuthContextType = {
    session,
    user,
    profile,
    role,
    loading: appInitialLoading, // Exposed as 'loading' for index.tsx
    actionInProgress, 
    error,
    signIn: wrappedSignIn,
    signUpWithRole: wrappedSignUpWithRole,
    signOut: handleSignOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};