// components/Navbar.tsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  navigateToLanding: () => void;
  navigateToAuth: () => void;
  navigateToDashboard: () => void; // For navigating to the correct user dashboard after login/auth
}

const Navbar: React.FC<NavbarProps> = ({ navigateToLanding, navigateToAuth, navigateToDashboard }) => {
  const { user, profile, role, signOut, loading: appIsLoading, actionInProgress } = useAuth(); // Use `loading` as appIsLoading

  const handleLogout = async () => {
    try {
      await signOut();
      navigateToLanding(); // Go to landing page after logout
    } catch (e) {
      console.error("Logout failed on Navbar:", e);
      // Error is already handled and potentially set in AuthContext
    }
  };

  return (
    <nav className="bg-gray-800 text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
        <button onClick={navigateToLanding} className="text-xl font-bold hover:text-gray-300 transition-colors">
          Influencer AI Flow
        </button>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <button 
            onClick={navigateToLanding} 
            className="px-2 sm:px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
            aria-label="Home"
          >
            Home
          </button>
          
          {user && profile && role === 'brand' && (
            <button 
              onClick={navigateToDashboard}
              className="px-2 sm:px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              My Campaigns
            </button>
          )}
          {user && profile && role === 'creator' && (
            <button 
              onClick={navigateToDashboard} // CreatorDashboard will handle internal routing
              className="px-2 sm:px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              My Dashboard
            </button>
          )}

          {appIsLoading && <span className="text-sm text-gray-400">Checking auth...</span>}
          
          {!appIsLoading && user && profile ? (
            <>
              <span className="text-sm text-gray-300 hidden sm:inline truncate max-w-[150px]" title={profile.full_name || user.email}>
                {profile.full_name || user.email} ({role})
              </span>
              <button 
                onClick={handleLogout}
                disabled={actionInProgress}
                className="px-2 sm:px-3 py-2 rounded-md text-sm font-medium bg-red-500 hover:bg-red-600 transition-colors disabled:bg-red-300"
              >
                {actionInProgress ? 'Logging out...' : 'Logout'}
              </button>
            </>
          ) : !appIsLoading && (
            <button 
              onClick={navigateToAuth}
              className="px-2 sm:px-3 py-2 rounded-md text-sm font-medium bg-blue-500 hover:bg-blue-600 transition-colors"
            >
              Login / Sign Up
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;