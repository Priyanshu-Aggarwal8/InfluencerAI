// services/authService.ts
import { supabase } from './supabaseClient';
// AuthSignUpOptions removed from this import
import type { SignInWithPasswordCredentials, User } from '@supabase/supabase-js';

// Define a local type for sign-up options if AuthSignUpOptions is not available/exported
interface LocalAuthSignUpOptions {
  emailRedirectTo?: string;
  data?: { [key: string]: any }; // For user_metadata
  captchaToken?: string;
}

// Define a type that accurately reflects the expected credentials for email sign-up,
// especially if the imported SignUpWithPasswordCredentials is problematic in the environment.
export interface EmailSignUpCredentials { // Exporting for use in AuthContext if needed for strong typing
  email: string;
  password: string;
  options?: LocalAuthSignUpOptions; // Use the locally defined type
}

export interface UserProfileData {
  role: 'creator' | 'brand';
  full_name?: string;
}

export async function signUpWithRole(credentials: EmailSignUpCredentials, profileData: UserProfileData) {
  // Prepare options, ensuring `data` from profileData is included
  // and any other options from credentials are respected.
  const signUpOptions: LocalAuthSignUpOptions = { ...(credentials.options || {}) }; // Use LocalAuthSignUpOptions and ensure it's an object

  // Ensure raw_user_meta_data is part of options.data for Supabase GoTrue (which is what options.data becomes for signUp)
  // Merge with existing data if any was passed in credentials.options.data
  signUpOptions.data = {
    ...(signUpOptions.data || {}), 
    role: profileData.role, 
    full_name: profileData.full_name || credentials.email.split('@')[0] || 'New User', 
  };


  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: signUpOptions // Pass the augmented options here
  });

  if (error) throw error;
  // The handle_new_user trigger in Supabase should create a profile entry using the role from options.data.
  return data;
}

export async function signIn(credentials: SignInWithPasswordCredentials) {
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getUser(): Promise<User | null> { // Ensure Promise<User | null> for clarity
  const { data: { user } , error } = await supabase.auth.getUser();
  if (error) {
      // Don't throw if error is just "no user" - this is a valid state
      if (error.message !== 'No user found' && error.message !== 'User not authenticated') {
          console.error("Error getting user:", error);
          throw error;
      }
  }
  return user;
}

// This function is illustrative of how onAuthStateChange is typically used.
// The AuthContext handles its own listener.
export function onAuthStateChange(callback: (event: string, session: import('@supabase/supabase-js').Session | null) => void) {
  const { data: authListener } = supabase.auth.onAuthStateChange(callback);
  return authListener;
}