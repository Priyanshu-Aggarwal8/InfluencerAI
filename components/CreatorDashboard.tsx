// components/CreatorDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CreatorProfileForm from './CreatorProfileForm';
import { 
    getAvailableCampaignsForCreator, 
    getEnrollmentsForCreator, 
    updateCreatorEnrollmentStatus,
    Campaign, 
    CampaignEnrollmentWithCampaignDetails,
    CampaignEnrollmentStatus
} from '../services/dbService';

type CreatorDashboardView = 'profile' | 'available_campaigns' | 'my_campaigns';

const CreatorDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [currentView, setCurrentView] = useState<CreatorDashboardView>('profile');

  const [availableCampaignsList, setAvailableCampaignsList] = useState<Campaign[]>([]);
  const [loadingAvailableCampaigns, setLoadingAvailableCampaigns] = useState(false);
  const [errorAvailableCampaigns, setErrorAvailableCampaigns] = useState<string | null>(null);

  const [enrolledCampaignsList, setEnrolledCampaignsList] = useState<CampaignEnrollmentWithCampaignDetails[]>([]);
  const [loadingEnrolledCampaigns, setLoadingEnrolledCampaigns] = useState(false);
  const [errorEnrolledCampaigns, setErrorEnrolledCampaigns] = useState<string | null>(null);
  const [actionLoadingEnrollment, setActionLoadingEnrollment] = useState<string | null>(null); // For accept/reject loading

  const fetchAvailableCampaigns = useCallback(async () => {
    if (!user) return;
    console.log('[CreatorDashboard.fetchAvailableCampaigns] Fetching for creator ID:', user.id);
    setLoadingAvailableCampaigns(true);
    setErrorAvailableCampaigns(null);
    try {
      const campaigns = await getAvailableCampaignsForCreator(user.id);
      console.log('[CreatorDashboard.fetchAvailableCampaigns] Received available campaigns:', campaigns);
      setAvailableCampaignsList(campaigns);
    } catch (err) {
      console.error("[CreatorDashboard.fetchAvailableCampaigns] Failed to fetch available campaigns:", err);
      const errorMsg = err instanceof Error ? err.message : "Could not load available campaigns.";
      setErrorAvailableCampaigns(errorMsg);
    } finally {
      setLoadingAvailableCampaigns(false);
    }
  }, [user]);

  const fetchEnrolledCampaigns = useCallback(async () => {
    if (!user) return;
    console.log('[CreatorDashboard.fetchEnrolledCampaigns] Fetching for creator ID:', user.id);
    setLoadingEnrolledCampaigns(true);
    setErrorEnrolledCampaigns(null);
    try {
      const enrollments = await getEnrollmentsForCreator(user.id);
      console.log('[CreatorDashboard.fetchEnrolledCampaigns] Received enrolled campaigns:', enrollments);
      setEnrolledCampaignsList(enrollments);
    } catch (err) {
      console.error("[CreatorDashboard.fetchEnrolledCampaigns] Failed to fetch enrolled campaigns:", err);
      const errorMsg = err instanceof Error ? err.message : "Could not load your enrolled campaigns.";
      setErrorEnrolledCampaigns(errorMsg);
    } finally {
      setLoadingEnrolledCampaigns(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && currentView === 'available_campaigns') {
      fetchAvailableCampaigns();
    }
    if (user && currentView === 'my_campaigns') {
      fetchEnrolledCampaigns();
    }
  }, [user, currentView, fetchAvailableCampaigns, fetchEnrolledCampaigns]);

  const handleEnrollmentAction = async (enrollmentId: string, newStatus: Extract<CampaignEnrollmentStatus, 'approved_by_creator' | 'rejected_by_creator'>) => {
    if (!user) return;
    console.log('[CreatorDashboard.handleEnrollmentAction] Action:', { enrollmentId, newStatus, userId: user.id });
    setActionLoadingEnrollment(enrollmentId); 
    setErrorEnrolledCampaigns(null); 
    try {
      const notes = newStatus === 'rejected_by_creator' ? prompt("Optional: Provide a reason for rejection") || undefined : undefined;
      await updateCreatorEnrollmentStatus(enrollmentId, newStatus, user.id, notes);
      alert(`Offer successfully ${newStatus === 'approved_by_creator' ? 'accepted' : 'rejected'}!`);
      fetchEnrolledCampaigns(); // Refresh the list
    } catch (err) {
      console.error(`[CreatorDashboard.handleEnrollmentAction] Failed to ${newStatus === 'approved_by_creator' ? 'accept' : 'reject'} offer:`, err);
      setErrorEnrolledCampaigns(err instanceof Error ? err.message : `Could not ${newStatus === 'approved_by_creator' ? 'accept' : 'reject'} offer.`);
    } finally {
      setActionLoadingEnrollment(null);
    }
  };


  if (!user || !profile) {
    return <div className="p-8 text-center text-red-500">Error: User data not available. Please try refreshing.</div>;
  }
  if (profile.role !== 'creator') {
     return <div className="p-8 text-center text-red-500">Access Denied: This dashboard is for creators.</div>;
  }

  const getStatusFriendlyName = (status: CampaignEnrollmentStatus): string => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  return (
    <div className="p-4 md:p-8">
      <header className="mb-8 pb-4 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-800">Creator Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome, {profile.full_name || user.email}!</p>
      </header>

      <nav className="mb-8 flex flex-wrap gap-2 sm:space-x-4 border-b pb-3">
        <button 
          onClick={() => setCurrentView('profile')}
          className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${currentView === 'profile' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
        >
          My Creator Profile
        </button>
        <button 
          onClick={() => setCurrentView('available_campaigns')}
          className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${currentView === 'available_campaigns' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
        >
          Available Campaigns
        </button>
        <button 
          onClick={() => setCurrentView('my_campaigns')}
          className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${currentView === 'my_campaigns' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
        >
          My Enrolled Campaigns
        </button>
      </nav>

      <div className="mt-6">
        {currentView === 'profile' && (
          <CreatorProfileForm userId={user.id} userFullName={profile.full_name} />
        )}

        {currentView === 'available_campaigns' && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Browse Available Campaigns</h2>
            {loadingAvailableCampaigns && <p className="text-gray-500">Loading available campaigns...</p>}
            {errorAvailableCampaigns && <div className="text-red-500 bg-red-50 p-3 rounded mb-3">{errorAvailableCampaigns}</div>}
            {!loadingAvailableCampaigns && !errorAvailableCampaigns && availableCampaignsList.length === 0 && (
              <p className="text-gray-500">No campaigns currently available for you, or all matching campaigns already have an offer extended to you. Check back later!</p>
            )}
            {!loadingAvailableCampaigns && !errorAvailableCampaigns && availableCampaignsList.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {availableCampaignsList.map(campaign => (
                  <div key={campaign.id} className="p-4 border rounded-lg shadow hover:shadow-lg transition-shadow">
                    <h3 className="text-lg font-semibold text-indigo-700 mb-1">{campaign.name}</h3>
                    <p className="text-sm text-gray-500 mb-1">Tag: {campaign.campaign_tag || 'N/A'}</p>
                    <p className="text-sm text-gray-600 line-clamp-3 mb-2" title={campaign.description}>{campaign.description || "No description available."}</p>
                    <p className="text-xs text-gray-400">Status: {campaign.status}</p>
                    {/* Future: Add "Apply" or "Express Interest" button if workflow supports it */}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === 'my_campaigns' && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">My Enrolled Campaigns</h2>
            {loadingEnrolledCampaigns && <p className="text-gray-500">Loading your enrolled campaigns...</p>}
            {errorEnrolledCampaigns && <div className="text-red-500 bg-red-50 p-3 rounded mb-3">{errorEnrolledCampaigns}</div>}
            {!loadingEnrolledCampaigns && !errorEnrolledCampaigns && enrolledCampaignsList.length === 0 && (
              <p className="text-gray-500">You are not currently enrolled in any campaigns or have no pending offers.</p>
            )}
            {!loadingEnrolledCampaigns && !errorEnrolledCampaigns && enrolledCampaignsList.length > 0 && (
              <div className="space-y-6">
                {enrolledCampaignsList.map(enrollment => (
                  <div key={enrollment.id} className="p-4 border rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold text-purple-700 mb-1">{enrollment.campaigns?.name || 'Campaign Details Missing'}</h3>
                    <p className="text-sm text-gray-500 mb-1">Status: <span className="font-medium">{getStatusFriendlyName(enrollment.status)}</span></p>
                    
                    {enrollment.status === 'approved_by_creator' && (
                         <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded my-1">Offer accepted! The brand will now prepare the contract and deliverables. Check back for updates.</p>
                    )}
                     {enrollment.status === 'contract_sent_to_creator' && ( // Placeholder for when creator can view contract
                         <p className="text-sm text-green-600 bg-green-50 p-2 rounded my-1">Contract received! Review and respond. (Viewing/signing feature coming soon)</p>
                    )}

                    {enrollment.offer_details && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded my-1">
                        <p className="font-medium">Offer Details:</p>
                        <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(enrollment.offer_details, null, 2)}</pre>
                      </div>
                    )}
                    {enrollment.enrolled_at && <p className="text-xs text-gray-400">Accepted on: {new Date(enrollment.enrolled_at).toLocaleDateString()}</p>}
                    
                    {enrollment.status === 'pending_creator_approval' && (
                      <div className="mt-3 pt-3 border-t border-gray-200 flex space-x-3">
                        <button
                          onClick={() => handleEnrollmentAction(enrollment.id, 'approved_by_creator')}
                          disabled={actionLoadingEnrollment === enrollment.id}
                          className="bg-green-500 hover:bg-green-600 text-white font-semibold py-1.5 px-3 rounded text-sm disabled:bg-gray-400"
                        >
                          {actionLoadingEnrollment === enrollment.id ? 'Accepting...' : 'Accept Offer'}
                        </button>
                        <button
                          onClick={() => handleEnrollmentAction(enrollment.id, 'rejected_by_creator')}
                          disabled={actionLoadingEnrollment === enrollment.id}
                          className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1.5 px-3 rounded text-sm disabled:bg-gray-400"
                        >
                          {actionLoadingEnrollment === enrollment.id ? 'Rejecting...' : 'Reject Offer'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorDashboard;
