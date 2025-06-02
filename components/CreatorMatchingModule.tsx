

// components/CreatorMatchingModule.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Campaign,
    MatchedInfluencer,
    Influencer,
    updateCampaign,
    logWorkflowStep,
    getInfluencersByTagsArray, // Updated import
    createCampaignEnrollment
} from '../services/dbService';

interface CreatorMatchingModuleProps {
  campaign: Campaign;
  onCampaignUpdate: (updatedCampaign: Campaign) => void;
  advanceWorkflowStep: (stepName: string, status: string, details?: object) => Promise<void>;
  currentUserId: string; // Brand's user ID
}

const CreatorMatchingModule: React.FC<CreatorMatchingModuleProps> = ({ campaign, onCampaignUpdate, advanceWorkflowStep, currentUserId }) => {
  const [availableInfluencers, setAvailableInfluencers] = useState<Influencer[]>([]);
  const [selectedInfluencerIds, setSelectedInfluencerIds] = useState<Set<string>>(() => {
    const initialIds = new Set<string>();
    if (campaign.matched_influencers_data) {
      campaign.matched_influencers_data.forEach(inf => initialIds.add(inf.id));
    }
    return initialIds;
  });

  const [fetchingInfluencers, setFetchingInfluencers] = useState(false);
  const [fetchingError, setFetchingError] = useState<string | null>(null);
  const [savingLoading, setSavingLoading] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);

  const parseCampaignTags = (tagsString: string | null | undefined): string[] => {
    if (!tagsString) return [];
    return tagsString.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag);
  };

  useEffect(() => {
    console.log('[CreatorMatchingModule] useEffect for fetchInfluencers triggered. Campaign ID:', campaign.id, 'Status:', campaign.status, 'Current Step:', campaign.current_workflow_step, 'Campaign Tag:', campaign.campaign_tag);

    const fetchInfluencers = async () => {
      const campaignTagsArray = parseCampaignTags(campaign.campaign_tag);
      console.log('[CreatorMatchingModule] Parsed campaign tags for query:', campaignTagsArray);

      if (campaignTagsArray.length > 0) {
        setFetchingInfluencers(true);
        setFetchingError(null);
        // setAvailableInfluencers([]); // Clear previous results before new fetch
        console.log('[CreatorMatchingModule] Attempting to fetch influencers...');
        try {
          const influencers = await getInfluencersByTagsArray(campaignTagsArray);
          console.log('[CreatorMatchingModule] Fetched influencers RAW:', JSON.stringify(influencers));
          setAvailableInfluencers(influencers);
        } catch (err) {
          console.error('[CreatorMatchingModule] Error fetching influencers in useEffect:', err);
          setFetchingError(err instanceof Error ? err.message : 'Could not load influencers. Check console for Supabase errors and ensure creator tags are lowercase in the database.');
          setAvailableInfluencers([]); // Clear on error
        } finally {
          setFetchingInfluencers(false);
        }
      } else {
        console.log('[CreatorMatchingModule] No campaign tags to query by. Clearing available influencers.');
        setAvailableInfluencers([]);
        setFetchingInfluencers(false); // Ensure loading is false if no tags
      }
    };

    const shouldFetch = campaign.status === 'New' ||
                        campaign.status === 'Matching' ||
                        campaign.current_workflow_step === 'Campaign Created';
    
    console.log('[CreatorMatchingModule] shouldFetch based on status/step:', shouldFetch);

    if (shouldFetch) {
        fetchInfluencers();
    } else if (campaign.matched_influencers_data && campaign.matched_influencers_data.length > 0) {
        // If not in active matching phase but have existing data,
        // try to fetch full details for these to enrich the view, e.g., for user_id.
        // This is a gentle re-fetch; if it fails, we still have matched_influencers_data.
        const campaignTagsArray = parseCampaignTags(campaign.campaign_tag);
        if (campaignTagsArray.length > 0 && availableInfluencers.length === 0 && !fetchingInfluencers) {
            console.log('[CreatorMatchingModule] Attempting gentle re-fetch for context on existing matched data.');
            fetchInfluencers();
        } else if (availableInfluencers.length === 0 && campaignTagsArray.length === 0) {
            // If no tags, we can't fetch, but we have existing data to show.
            // Potentially map matched_influencers_data to availableInfluencers if structure matches
            // or enhance display logic to use matched_influencers_data directly.
            // For now, this path means the display logic will rely on `campaign.matched_influencers_data`.
        }
    } else {
        console.log('[CreatorMatchingModule] Conditions not met for fetching, or no existing matched data to enrich. Clearing available influencers.');
        setAvailableInfluencers([]);
    }
  }, [campaign.campaign_tag, campaign.status, campaign.current_workflow_step, campaign.id, campaign.matched_influencers_data]); // Removed fetchingInfluencers and availableInfluencers from deps


  const handleToggleInfluencer = (influencerId: string) => {
    setSelectedInfluencerIds(prevIds => {
      const newIds = new Set(prevIds);
      if (newIds.has(influencerId)) {
        newIds.delete(influencerId);
      } else {
        newIds.add(influencerId);
      }
      return newIds;
    });
  };

  const handleSaveMatches = async () => {
    setSavingLoading(true);
    setSavingError(null);
    console.log('[CreatorMatchingModule.handleSaveMatches] Starting to save matches/create enrollments.');
    console.log('[CreatorMatchingModule.handleSaveMatches] Selected Influencer IDs (these are influencers.id):', Array.from(selectedInfluencerIds));
    console.log('[CreatorMatchingModule.handleSaveMatches] All Available Influencers (for lookup):', availableInfluencers);

    const selectedFullInfluencers = availableInfluencers.filter(inf => selectedInfluencerIds.has(inf.id));

    if (selectedFullInfluencers.length === 0) {
      setSavingError("No influencers selected to save or offer.");
      setSavingLoading(false);
      console.warn('[CreatorMatchingModule.handleSaveMatches] No influencers selected.');
      return;
    }
    console.log('[CreatorMatchingModule.handleSaveMatches] Filtered selectedFullInfluencers:', selectedFullInfluencers);

    try {
      let enrolledCount = 0;
      const enrollmentErrors: string[] = [];
      const successfulEnrollmentDetails: any[] = [];

      for (const influencer of selectedFullInfluencers) {
        console.log(`[CreatorMatchingModule.handleSaveMatches] Processing selected influencer: ${influencer.name} (ID: ${influencer.id}, User/Profile ID: ${influencer.user_id})`);
        if (!influencer.user_id) {
          const missingIdMsg = `Cannot enroll influencer ${influencer.name} (ID: ${influencer.id}) as their user_id (profile ID for enrollment) is missing. Please ensure creator profile is complete.`;
          console.error(missingIdMsg);
          enrollmentErrors.push(missingIdMsg);
          continue;
        }
        try {
          const offerDetails = {
            message: `Hi ${influencer.name}, we'd love to collaborate with you on our campaign: ${campaign.name}!`,
            proposed_budget_share: campaign.budget ? (campaign.budget / selectedFullInfluencers.length).toFixed(2) : 'To be discussed'
          };
          console.log(`[CreatorMatchingModule.handleSaveMatches] Calling createCampaignEnrollment for campaign ${campaign.id}, influencer_user_id ${influencer.user_id}, brand_user_id ${currentUserId}`);
          const enrollment = await createCampaignEnrollment(campaign.id, influencer.user_id, currentUserId, offerDetails);
          console.log(`[CreatorMatchingModule.handleSaveMatches] Enrollment successful for ${influencer.name}:`, enrollment);
          successfulEnrollmentDetails.push({ influencer_name: influencer.name, enrollment_id: enrollment.id });
          enrolledCount++;
        } catch (enrollErr) {
          const enrollErrMsg = enrollErr instanceof Error ? enrollErr.message : `Offer failed for ${influencer.name}.`;
          console.error(`[CreatorMatchingModule.handleSaveMatches] Failed to create enrollment for influencer ${influencer.name}:`, enrollErrMsg, enrollErr);
          enrollmentErrors.push(enrollErrMsg);
        }
      }

      if (enrollmentErrors.length > 0) {
        const fullErrorMsg = `Some offers failed: ${enrollmentErrors.join('; ')}`;
        setSavingError(fullErrorMsg);
        console.warn('[CreatorMatchingModule.handleSaveMatches] Enrollment errors occurred:', fullErrorMsg);
      }

      const matchedForCampaignData: MatchedInfluencer[] = selectedFullInfluencers.map(inf => ({
        id: inf.id,
        name: inf.name,
        niche: inf.niche // Primary niche for display
      }));

      const updatedCampaignArray = await updateCampaign(campaign.id, {
        matched_influencers_data: matchedForCampaignData,
      });

      if (updatedCampaignArray && updatedCampaignArray.length > 0 && updatedCampaignArray[0]) {
        onCampaignUpdate(updatedCampaignArray[0]);
        await advanceWorkflowStep('Creator Offers Sent', 'Offers Sent', {
          offers_sent_count: enrolledCount,
          successful_enrollments: successfulEnrollmentDetails,
          failed_offer_count: enrollmentErrors.length,
          brand_user_id: currentUserId
        });
        if (enrollmentErrors.length === 0 && enrolledCount > 0) {
          alert(`${enrolledCount} influencer(s) have been invited to the campaign.`);
        } else if (enrolledCount > 0) {
            alert(`${enrolledCount} influencer(s) invited. Some offers may have failed. Check errors.`);
        }
      } else {
        throw new Error("Failed to update campaign after attempting enrollment offers.");
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error('[CreatorMatchingModule.handleSaveMatches] Overall error saving matches/sending offers:', errorMessage, err);
      if (!savingError) setSavingError(errorMessage);
      await logWorkflowStep(campaign.id, 'Creator Offers Send Failed', { error: errorMessage, brand_user_id: currentUserId }, 'failed');
    } finally {
      setSavingLoading(false);
    }
  };

  const isMatchingPhaseActive = campaign.status === 'New' ||
                                campaign.status === 'Matching' ||
                                campaign.current_workflow_step === 'Campaign Created' ||
                                campaign.current_workflow_step === 'Creator Matching Complete';

  const campaignTagsArrayForDisplay = parseCampaignTags(campaign.campaign_tag);
  const campaignTagsForDisplay = campaignTagsArrayForDisplay.join(', ') || 'Not specified';

  const listTitle = isMatchingPhaseActive ? "Selected for Offer:" : "Previously Selected/Offered Influencers:";
  let influencersToDisplayInList: Array<{id: string, name: string, niche: string, user_id?: string | null}> = [];

  if (isMatchingPhaseActive) {
      influencersToDisplayInList = availableInfluencers
          .filter(inf => selectedInfluencerIds.has(inf.id))
          .map(inf => ({ id: inf.id, name: inf.name, niche: inf.niche, user_id: inf.user_id }));
  } else if (campaign.matched_influencers_data && campaign.matched_influencers_data.length > 0) {
      influencersToDisplayInList = campaign.matched_influencers_data.map(matchedInf => {
          // Try to find full detail from availableInfluencers if they were fetched (e.g., for user_id)
          const fullDetail = availableInfluencers.find(ai => ai.id === matchedInf.id);
          return {
              id: matchedInf.id,
              name: matchedInf.name,
              niche: matchedInf.niche,
              user_id: fullDetail?.user_id 
          };
      });
  }


  return (
    <div className="p-6 border border-gray-200 rounded-lg shadow">
      <h3 className="text-xl font-semibold text-gray-700 mb-4">1. Creator Matching &amp; Offers</h3>

      {!isMatchingPhaseActive && campaign.matched_influencers_data && campaign.matched_influencers_data.length > 0 && (
          <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded mb-3">
            Initial matching/offer phase may be complete. Current step: {campaign.current_workflow_step}.
          </p>
      )}

      {savingError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{savingError}</div>}

      {isMatchingPhaseActive && (
        <>
          <p className="text-sm text-gray-600 mb-2">
            Searching for influencers matching campaign tags: <strong className="text-indigo-600">{campaignTagsForDisplay}</strong>.
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Select influencers to send collaboration offers for: "{campaign.goals || 'General Campaign'}". Creators are matched if any of their profile tags align with the campaign tags.
          </p>
        </>
      )}

      {fetchingInfluencers && <p className="text-sm text-blue-600 my-3 p-3 bg-blue-50 border border-blue-200 rounded">Loading influencers based on tags...</p>}
      {fetchingError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded my-3">{fetchingError}</div>}

      {!fetchingInfluencers && !fetchingError && availableInfluencers.length === 0 && isMatchingPhaseActive && campaignTagsArrayForDisplay.length > 0 && (
        <div className="text-sm text-orange-600 bg-orange-50 p-3 rounded my-3 border border-orange-200">
            <p className="font-medium">No influencers found matching the tags: "{campaignTagsForDisplay}".</p>
            <p className="text-xs mt-1">Troubleshooting tips:</p>
            <ul className="list-disc list-inside pl-4 text-xs">
                <li>Ensure creator profiles exist in the database.</li>
                <li>Check that creator profiles have `content_tags` that include at least one of these campaign tags.</li>
                <li>Creator `content_tags` in the database **MUST be lowercase** (e.g., "lifestyle", not "Lifestyle"). Run the provided SQL script if you haven't.</li>
                <li>Verify in browser console logs: search for `[dbService.getInfluencersByTagsArray] Supabase RAW response` to see if Supabase returned any data.</li>
            </ul>
        </div>
      )}
      {!fetchingInfluencers && !fetchingError && isMatchingPhaseActive && campaignTagsArrayForDisplay.length === 0 && (
        <p className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded my-3 border border-yellow-300">
            Please specify comma-separated campaign tags in the main campaign form to find relevant influencers. Matching cannot proceed without tags.
        </p>
      )}

      {availableInfluencers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          {availableInfluencers.map(influencer => (
            <div
              key={influencer.id}
              onClick={() => isMatchingPhaseActive && handleToggleInfluencer(influencer.id)}
              className={`p-3 border rounded-md transition-all
                          ${selectedInfluencerIds.has(influencer.id) ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-300' : 'bg-gray-50 hover:bg-gray-100 border-gray-300'}
                          ${isMatchingPhaseActive ? 'cursor-pointer' : 'opacity-70 cursor-not-allowed'}`}
              role={isMatchingPhaseActive ? "button" : undefined}
              tabIndex={isMatchingPhaseActive ? 0 : -1}
              aria-pressed={selectedInfluencerIds.has(influencer.id)}
            >
              <h4 className="font-medium text-gray-800">{influencer.name}</h4>
              <p className="text-sm text-gray-500">Primary Niche: {influencer.niche}</p>
              <p className="text-xs text-gray-400">Relevant Tags: {(influencer.content_tags || []).join(', ') || 'N/A'}</p>
              <p className="text-xs text-gray-400">Followers: {influencer.followers?.toLocaleString() || 'N/A'}</p>
              {!influencer.user_id && <p className="text-xs text-red-500">Warning: Profile ID (user_id) missing, cannot enroll.</p>}
              {influencer.user_id && <p className="text-xs text-green-500">Profile ID: {influencer.user_id.substring(0,8)}...</p>}
            </div>
          ))}
        </div>
      )}

      {isMatchingPhaseActive && availableInfluencers.length > 0 && (
        <button
          onClick={handleSaveMatches}
          disabled={savingLoading || selectedInfluencerIds.size === 0}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
        >
          {savingLoading ? 'Sending Offers...' : `Send Offers to ${selectedInfluencerIds.size} Influencer(s)`}
        </button>
      )}

      { influencersToDisplayInList.length > 0  && (
          <div className="mt-6">
              <h4 className="font-medium text-gray-700 mb-2">{listTitle}</h4>
              <ul className="list-disc list-inside pl-2 text-sm text-gray-600 space-y-1">
                  {influencersToDisplayInList.map(inf => (
                      <li key={inf.id}>
                          {inf.name} (Primary Niche: {inf.niche})
                          {inf.user_id ? ` (Profile ID: ${inf.user_id.substring(0,8)}...)` :
                           (isMatchingPhaseActive && !inf.user_id) ? ' (Missing Profile ID for offer)' : ''}
                      </li>
                  ))}
              </ul>
          </div>
      )}
      { selectedInfluencerIds.size > 0 && influencersToDisplayInList.length === 0 && !isMatchingPhaseActive && (
          <div className="mt-6">
              <h4 className="font-medium text-gray-700 mb-2">{listTitle}</h4>
              <p className="text-sm text-gray-400 italic">Details for previously selected influencers might not be fully available if campaign tags or influencer profiles have changed significantly.</p>
          </div>
      )}

    </div>
  );
};

export default CreatorMatchingModule;
