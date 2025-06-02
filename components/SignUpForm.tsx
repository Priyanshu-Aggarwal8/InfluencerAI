// components/SignUpForm.tsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext'; 
import type { UserProfileData, EmailSignUpCredentials } from '../services/authService'; // Import types

interface SignUpFormProps {
  onAuthSuccess: () => void;
}

const SignUpForm: React.FC<SignUpFormProps> = ({ onAuthSuccess }) => {
  const { signUpWithRole, error: contextError, actionInProgress } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'creator' | 'brand'>('creator');
  const [formError, setFormError] = useState<string | null>(null); // Specific form errors

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null); // Clear previous form errors
    
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setFormError("Password should be at least 6 characters long.");
      return;
    }

    const credentials: EmailSignUpCredentials = { email, password };
    const profileData: UserProfileData = { role, full_name: fullName || undefined };

    try {
      await signUpWithRole(credentials, profileData);
      onAuthSuccess(); // Navigate to dashboard or next step
    } catch (err) {
      // error from AuthContext will be set if it's an AuthError from Supabase
      // For other errors or more specific form feedback:
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('An unknown error occurred during sign up.');
      }
      console.error('Sign up failed from form:', err);
    }
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
      {formError && <div className="p-3 bg-red-100 text-red-700 rounded text-sm">{formError}</div>}
      {/* Display error from AuthContext if it's set and not overridden by formError */}
      {!formError && contextError && <div className="p-3 bg-red-100 text-red-700 rounded text-sm">{contextError}</div>}
      
      <div className="rounded-md shadow-sm -space-y-px">
        <div>
          <label htmlFor="fullName" className="sr-only">Full Name (Optional)</label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm bg-white"
            placeholder="Full Name (Optional)"
          />
        </div>
        <div>
          <label htmlFor="email-address-signup" className="sr-only">Email address</label>
          <input
            id="email-address-signup"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm bg-white"
            placeholder="Email address"
          />
        </div>
        <div>
          <label htmlFor="password-signup" className="sr-only">Password</label>
          <input
            id="password-signup"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm bg-white"
            placeholder="Password (min. 6 characters)"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="sr-only">Confirm Password</label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm bg-white"
            placeholder="Confirm Password"
          />
        </div>
         <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 py-2">I am a...</label>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'creator' | 'brand')}
            required
            className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm bg-white"
          >
            <option value="creator">Creator / Influencer</option>
            <option value="brand">Brand / Company</option>
          </select>
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={actionInProgress}
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
        >
          {actionInProgress ? 'Signing up...' : 'Sign up'}
        </button>
      </div>
    </form>
  );
};

export default SignUpForm;