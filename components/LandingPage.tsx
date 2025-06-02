// components/LandingPage.tsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LandingPageProps {
  navigateToAuth: () => void;
  navigateToDashboard: () => void; 
}

const LandingPage: React.FC<LandingPageProps> = ({ navigateToAuth, navigateToDashboard }) => {
  const { user, profile, role, loading: appIsLoading } = useAuth(); // Use `loading` as appIsLoading

  const handleGetStarted = () => {
    if (appIsLoading) return; 
    if (user && profile) {
      navigateToDashboard(); 
    } else {
      navigateToAuth(); 
    }
  };
  
  const primaryActionText = user && profile 
    ? (role === 'brand' ? 'Manage My Campaigns' : 'Go To My Dashboard')
    : 'Get Started Now';

  // Simplified secondary action: if logged in, it's always "Go to Dashboard"
  // If not logged in, no secondary action on this page, primary is "Get Started" -> Auth
  const secondaryActionText = user && profile 
    ? `View ${role === 'brand' ? 'Campaigns' : 'Dashboard'}`
    : null; 

  const handleSecondaryAction = () => {
    if (appIsLoading) return;
    if (user && profile) {
        navigateToDashboard(); 
    } else {
      // This case should not be reachable if secondaryActionText is null
      navigateToAuth();
    }
  };


  return (
    <div className="flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white p-8 text-center flex-grow">
      <header className="mb-12">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4 animate-fade-in-down">
          Influencer Marketing, Reimagined.
        </h1>
        <p className="text-xl md:text-2xl text-indigo-100 mb-8 animate-fade-in-up max-w-2xl mx-auto">
          Orchestrate your entire influencer campaign workflow, from creation to reporting, powered by AI and automation. For Brands and Creators.
        </p>
      </header>

      <main className="flex flex-col items-center md:flex-row gap-4 md:gap-6 animate-fade-in">
        <button
          onClick={handleGetStarted}
          disabled={appIsLoading}
          className="bg-white text-purple-700 font-bold py-3 px-8 rounded-lg shadow-xl hover:bg-gray-100 transform hover:scale-105 transition-all duration-300 ease-in-out text-lg w-full md:w-auto"
        >
          🚀 {appIsLoading ? "Loading..." : primaryActionText}
        </button>
        {secondaryActionText && !appIsLoading && ( // Only show if logged in and not loading
             <button
                onClick={handleSecondaryAction}
                disabled={appIsLoading}
                className="bg-transparent border-2 border-white text-white font-bold py-3 px-8 rounded-lg shadow-xl hover:bg-white hover:text-purple-700 transform hover:scale-105 transition-all duration-300 ease-in-out text-lg w-full md:w-auto"
             >
                {appIsLoading ? "Loading..." : secondaryActionText}
             </button>
        )}
      </main>

      <section className="mt-16 max-w-4xl w-full mx-auto animate-fade-in-slow">
        <h2 className="text-3xl font-bold mb-8 text-white">Key Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-white/20 backdrop-blur-md p-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300">
            <h3 className="text-xl font-semibold mb-2 text-indigo-100">✨ AI-Powered Matching</h3>
            <p className="text-sm text-indigo-200">Discover the perfect influencers using advanced AI to analyze profiles and campaign goals.</p>
          </div>
          <div className="bg-white/20 backdrop-blur-md p-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300">
            <h3 className="text-xl font-semibold mb-2 text-indigo-100">📢 Automated Outreach</h3>
            <p className="text-sm text-indigo-200">Generate personalized, multilingual messages and even synthesize voice for impactful communication.</p>
          </div>
          <div className="bg-white/20 backdrop-blur-md p-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300">
            <h3 className="text-xl font-semibold mb-2 text-indigo-100">⚙️ Streamlined Workflow</h3>
            <p className="text-sm text-indigo-200">Manage contracts, payments, and performance reporting, all within a unified platform.</p>
          </div>
        </div>
      </section>

      <footer className="mt-20 text-indigo-200 text-sm animate-fade-in-very-slow">
        <p>&copy; {new Date().getFullYear()} Influencer Workflow AI. All rights reserved.</p>
      </footer>

      {/* Ensure these styles are scoped or use Tailwind classes if preferred */}
      <style>{`
        @keyframes fade-in-down {
          0% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .animate-fade-in-down { animation: fade-in-down 0.5s ease-out forwards; }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out 0.2s forwards; }
        .animate-fade-in { animation: fade-in 1s ease-out 0.4s forwards; }
        .animate-fade-in-slow { animation: fade-in 1s ease-out 0.6s forwards; }
        .animate-fade-in-very-slow { animation: fade-in 1s ease-out 0.8s forwards; }
      `}</style>
    </div>
  );
};

export default LandingPage;