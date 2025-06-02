// components/AuthPage.tsx
import React, { useState } from 'react';
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';

interface AuthPageProps {
  onAuthSuccess: () => void; // Callback to navigate after successful auth
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [isLoginView, setIsLoginView] = useState(true);

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50"> 
      {/* Adjust min-h if navbar height is different (e.g., 64px is a common Tailwind navbar height) */}
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-xl shadow-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isLoginView ? 'Sign in to your account' : 'Create your account'}
          </h2>
        </div>
        
        {isLoginView ? (
          <LoginForm onAuthSuccess={onAuthSuccess} />
        ) : (
          <SignUpForm onAuthSuccess={onAuthSuccess} />
        )}

        <div className="text-sm text-center">
          {isLoginView ? (
            <p className="text-gray-600">
              Don't have an account?{' '}
              <button 
                onClick={() => setIsLoginView(false)} 
                className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:underline"
                aria-label="Switch to sign up form"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p className="text-gray-600">
              Already have an account?{' '}
              <button 
                onClick={() => setIsLoginView(true)} 
                className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:underline"
                aria-label="Switch to sign in form"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;