// components/BrandDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCampaigns, Campaign, deleteCampaign } from '../services/dbService';
import CampaignForm from './CampaignForm';
import CampaignDetailView from './CampaignDetailView';
import type { MainApplicationView } from '../index'; // Assuming this type is exported from index.tsx

const BrandDashboard: React.FC = () => {
  const { user, profile } = useAuth(); // Get authenticated user and their profile
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [currentView, setCurrentView] = useState<MainApplicationView>('dashboard');
  const [loadingCampaigns, setLoadingCampaigns] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null); // For errors during actions like delete

  const fetchUserCampaigns = useCallback(async () => {
    if (!user) return; // Should not happen if routed here correctly
    setLoadingCampaigns(true);
    setActionError(null);
    try {
      const fetchedCampaigns = await getCampaigns(user.id); // Fetch campaigns for this brand user
      setCampaigns(fetchedCampaigns || []);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
      setActionError(err instanceof Error ? err.message : 'An unknown error occurred while fetching campaigns.');
    } finally {
      setLoadingCampaigns(false);
    }
  }, [user]);

  useEffect(() => {
    // Fetch campaigns when component mounts and user is available,
    // or when returning to dashboard view.
    if (user && currentView === 'dashboard') {
      fetchUserCampaigns();
    }
  }, [fetchUserCampaigns, user, currentView]);

  const handleCampaignCreated = () => {
    setCurrentView('dashboard'); // Switch back to dashboard view
    fetchUserCampaigns(); // Refresh the list
  };

  const handleViewDetails = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setCurrentView('campaignDetail');
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!user) return; // Guard against user being null
    if (window.confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      setLoadingCampaigns(true); // Use general loading or specific action loading
      setActionError(null);
      try {
        await deleteCampaign(campaignId, user.id); // Pass brandUserId for RLS check
        setCampaigns(prevCampaigns => prevCampaigns.filter(c => c.id !== campaignId));
        alert('Campaign deleted successfully.');
        if (selectedCampaign?.id === campaignId) {
            setCurrentView('dashboard');
            setSelectedCampaign(null);
        }
      } catch (err) {
        console.error('Failed to delete campaign:', err);
        setActionError(err instanceof Error ? err.message : 'An unknown error occurred while deleting campaign.');
      } finally {
        setLoadingCampaigns(false);
      }
    }
  };

  const navigateToCreateCampaign = () => setCurrentView('createCampaign');
  const navigateToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedCampaign(null); // Clear selection
    fetchUserCampaigns(); // Optionally refresh when coming back
  };

  // Should be guaranteed by AppContent logic
  if (!user || !profile) {
    return <div className="p-8 text-center text-red-500">Error: Brand user data not available. Please refresh.</div>;
  }
   if (profile.role !== 'brand') {
     return <div className="p-8 text-center text-red-500">Access Denied: This dashboard is for brands.</div>;
  }
  
  const renderCampaignListView = () => (
    <div className="p-4 md:p-8">
      <header className="mb-8 pb-4 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-800">Brand Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome, {profile.full_name || user.email}! Manage your campaigns here.</p>
      </header>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4 md:mb-0">My Campaigns</h2>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={navigateToCreateCampaign}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded whitespace-nowrap shadow hover:shadow-md transition-shadow"
          >
            + Create New Campaign
          </button>
          <button 
            onClick={fetchUserCampaigns} 
            disabled={loadingCampaigns} 
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded whitespace-nowrap shadow hover:shadow-md transition-shadow disabled:bg-gray-400"
          >
            {loadingCampaigns && campaigns.length > 0 ? 'Refreshing...' : 'Refresh Campaigns'}
          </button>
        </div>
      </div>

      {actionError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-sm" role="alert">{actionError}</div>}
      
      {loadingCampaigns && campaigns.length === 0 && <div className="text-center py-4 text-gray-600">Loading your campaigns...</div>}

      {!loadingCampaigns && !actionError && campaigns.length === 0 && (
        <div className="text-center text-gray-500 py-10 bg-white p-6 rounded-lg shadow">
          <p className="text-xl mb-2">No campaigns found.</p>
          <p className="mb-4">Get started by creating your first influencer marketing campaign!</p>
          <button 
            onClick={navigateToCreateCampaign}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded"
          >
            Create First Campaign
          </button>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map(campaign => (
            <div key={campaign.id} className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-semibold text-indigo-600 mb-2 truncate" title={campaign.name}>{campaign.name}</h3>
                <p className="text-gray-700 text-sm mb-1"><span className="font-medium">Status:</span> <span className="font-semibold">{campaign.status || 'N/A'}</span></p>
                <p className="text-gray-700 text-sm mb-1"><span className="font-medium">Current Step:</span> {campaign.current_workflow_step || 'N/A'}</p>
                <p className="text-gray-700 text-sm mb-1"><span className="font-medium">Budget:</span> {campaign.budget ? `$${campaign.budget.toLocaleString()}` : 'N/A'}</p>
                <p className="text-gray-700 text-sm mb-3"><span className="font-medium">Tag:</span> {campaign.campaign_tag || 'N/A'}</p>
                <p className="text-gray-500 text-xs break-words line-clamp-3" title={campaign.description}>Description: {campaign.description || "No description."}</p>
              </div>
              <div className="mt-4 flex items-center space-x-2">
                <button 
                  onClick={() => handleViewDetails(campaign)}
                  className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded text-sm text-center"
                >
                  View & Manage
                </button>
                 <button 
                  onClick={() => handleDeleteCampaign(campaign.id)}
                  disabled={loadingCampaigns} // Disable if any campaign list related loading is happening
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-3 rounded text-sm disabled:bg-red-300"
                  aria-label={`Delete campaign ${campaign.name}`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );


  if (currentView === 'dashboard') {
    return renderCampaignListView();
  } else if (currentView === 'createCampaign') {
    return (
      <div className="p-4 md:p-8">
        <CampaignForm 
          currentUserId={user.id} // Pass authenticated user ID
          onCampaignCreated={handleCampaignCreated} 
          onCancel={navigateToDashboard}
        />
      </div>
    );
  } else if (currentView === 'campaignDetail' && selectedCampaign) {
    return (
      <div className="p-4 md:p-8">
        <CampaignDetailView 
          campaign={selectedCampaign} 
          onBack={navigateToDashboard}
          onCampaignUpdate={fetchUserCampaigns} // Refresh list in parent after any update in detail view
          currentUserId={user.id} // Pass current user ID for context
        />
      </div>
    );
  }

  return renderCampaignListView(); // Fallback, should ideally not be reached if logic is sound
};

export default BrandDashboard;