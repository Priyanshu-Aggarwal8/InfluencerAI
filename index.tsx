// index.tsx
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import BrandDashboard from './components/BrandDashboard';
import CreatorDashboard from './components/CreatorDashboard';
// Campaign type might still be needed if BrandDashboard or other components reference it directly for props.
// import { Campaign } from './services/dbService'; 

export type MainApplicationView = 'dashboard' | 'createCampaign' | 'campaignDetail';

const AppContent: React.FC = () => {
  // 'loading' from useAuth is now appIsLoading from the refined AuthContext
  const { user, profile, role, loading: appIsLoading, error: authError } = useAuth(); 
  
  const [appView, setAppView] = useState<'landing' | 'auth' | 'userDashboard'>('landing');

  const navigateToLanding = () => setAppView('landing');
  const navigateToAuth = () => setAppView('auth');
  
  const navigateToDashboard = () => {
    if (user && profile) {
      setAppView('userDashboard');
    } else {
      // This case implies user is not fully authenticated or profile is missing.
      // AuthPage is a safe fallback.
      setAppView('auth'); 
    }
  };


  if (appIsLoading) { // Use the correct loading state from AuthContext
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading Application...</div>
      </div>
    );
  }

  const renderMainContent = () => {
    // If user is not authenticated (user or profile is null)
    if (!user || !profile) { 
      if (appView === 'auth') {
        return <AuthPage onAuthSuccess={navigateToDashboard} />;
      }
      // Default to landing page if not authenticated and not explicitly on auth page
      return <LandingPage 
                navigateToAuth={navigateToAuth} 
                navigateToDashboard={navigateToDashboard} // This will likely redirect to auth if user not set
             />;
    }

    // User is authenticated, profile is loaded
    // If appView is 'landing', show landing page (e.g., user clicked "Home")
    if (appView === 'landing') {
         return <LandingPage 
                    navigateToAuth={navigateToAuth} // Will be ignored if already auth'd
                    navigateToDashboard={navigateToDashboard} 
                 />;
    }
    
    // If appView is 'auth' but user is somehow authenticated, redirect to dashboard
    if (appView === 'auth' && user && profile) {
        // This state should ideally be automatically handled by navigateToDashboard on auth success
        // Forcing dashboard view if user is authenticated but appView is stuck on 'auth'
        if (role === 'brand') return <BrandDashboard />;
        if (role === 'creator') return <CreatorDashboard />;
    }


    // At this point, user is authenticated, profile is loaded.
    // appView should ideally be 'userDashboard' or will be forced to it.
    if (role === 'brand') {
      return <BrandDashboard />;
    } else if (role === 'creator') {
      return <CreatorDashboard />;
    } else {
      // Fallback if role is somehow null/undefined after profile load
      // This could happen if the profile creation trigger failed or role wasn't set
      return (
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Role Not Determined</h1>
          <p className="text-gray-700 mb-4">
            We couldn't determine your user role. This might be a temporary issue or your profile setup might be incomplete.
            This can occur if the 'role' was not correctly set during sign-up in the user's metadata,
            or if the database trigger to create the profile failed.
          </p>
          {authError && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">{authError}</p>}
          <p className="text-gray-600">Please try logging out and signing in again. If the problem persists, ensure your account was created with a selected role or contact support.</p>
        </div>
      );
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar 
        navigateToLanding={navigateToLanding} 
        navigateToAuth={navigateToAuth}
        navigateToDashboard={navigateToDashboard}
      />
      <main className="flex-grow">
        {authError && appView !== 'auth' && !appIsLoading && ( // Show global auth errors if not on auth page and not initial loading
          <div className="p-4 bg-red-100 text-red-700 text-center">
            Authentication error: {authError}.
          </div>
        )}
        {renderMainContent()}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<React.StrictMode><App /></React.StrictMode>);
} else {
  console.error('Failed to find the root element');
}