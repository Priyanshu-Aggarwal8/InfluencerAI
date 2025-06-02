// components/OutreachModule.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Campaign, MatchedInfluencer, logWorkflowStep } from '../services/dbService';
import { GoogleGenAI } from '@google/genai';

interface OutreachModuleProps {
  campaign: Campaign;
  onCampaignUpdate: (updatedCampaign: Campaign) => void;
  advanceWorkflowStep: (stepName: string, status: string, details?: object) => Promise<void>;
  currentUserId: string; // Added for context if needed by logging/permissions
}

const OutreachModule: React.FC<OutreachModuleProps> = ({ campaign, onCampaignUpdate, advanceWorkflowStep, currentUserId }) => {
  const [aiClient, setAiClient] = useState<GoogleGenAI | null>(null);
  const [aiClientError, setAiClientError] = useState<string | null>(null);
  
  const [selectedInfluencerForManual, setSelectedInfluencerForManual] = useState<MatchedInfluencer | null>(null);
  const [manualGeneratedMessage, setManualGeneratedMessage] = useState<string>('');
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState<string | null>(null); 
  
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [autoProcessingLog, setAutoProcessingLog] = useState<string[]>([]);
  const [currentProcessingInfluencerName, setCurrentProcessingInfluencerName] = useState<string | null>(null);

  const isAutoProcessingStateRef = useRef(isAutoProcessing);
  useEffect(() => {
    isAutoProcessingStateRef.current = isAutoProcessing;
  }, [isAutoProcessing]);

  useEffect(() => {
    try {
        const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) 
            ? process.env.API_KEY 
            : (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY)
            ? import.meta.env.VITE_GEMINI_API_KEY
            : null;

        if (apiKey) {
            if (!aiClient) { // Initialize only if not already set
              setAiClient(new GoogleGenAI({ apiKey }));
            }
        } else {
            const warningMsg = "Gemini API Key not found. Outreach message generation will be disabled. Set API_KEY or VITE_GEMINI_API_KEY in your environment.";
            console.warn(warningMsg);
            if (!aiClientError) setAiClientError(warningMsg); // Set error only if not already set, to avoid loops
        }
    } catch (e) {
        console.error("Error initializing GoogleGenAI:", e);
        if (!aiClientError) setAiClientError("Failed to initialize AI Client. Message generation disabled.");
    }
  // aiClientError is added to prevent re-running if an error is already set.
  // aiClient is in the dependency array to re-initialize if it somehow becomes null.
  }, [aiClient, aiClientError]); 

  const logAutoProcessingEvent = useCallback((message: string) => {
    setAutoProcessingLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  }, []);

  const generateAIMessage = useCallback(async (influencer: MatchedInfluencer): Promise<string> => {
    if (!aiClient) {
      throw new Error("Gemini API Client not initialized. Check API Key.");
    }
    const prompt = `Generate a friendly and concise outreach email to an influencer named ${influencer.name} (niche: ${influencer.niche}) for a marketing campaign titled "${campaign.name}". 
The campaign goals are: "${campaign.goals || 'to promote our new product/service'}". 
The campaign budget is approximately ${campaign.budget ? `$${campaign.budget}` : 'negotiable'}.
Keep the tone professional but approachable. Express interest in their work and propose a potential collaboration.
Include placeholders like [Your Company Name] and [Your Name/Contact Info]. Limit to 150 words.`;
    
    logAutoProcessingEvent(`Generating AI message for ${influencer.name} with prompt...`);
    const response = await aiClient.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17", // Updated model
      contents: prompt,
    });
    logAutoProcessingEvent(`AI message successfully generated for ${influencer.name}.`);
    return response.text;
  }, [campaign.name, campaign.goals, campaign.budget, aiClient, logAutoProcessingEvent]);

  const simulateSendMessage = useCallback(async (influencer: MatchedInfluencer, message: string): Promise<void> => {
    logAutoProcessingEvent(`Simulating sending message to ${influencer.name}...`);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
    await logWorkflowStep(campaign.id, 'Outreach Message Sent (Simulated)', { influencer_id: influencer.id, influencer_name: influencer.name, message_preview: message.substring(0,70) + "...", brand_user_id: currentUserId }, 'success');
    logAutoProcessingEvent(`Message simulation complete for ${influencer.name}.`);
  }, [campaign.id, currentUserId, logAutoProcessingEvent]);


  useEffect(() => {
    let didCancel = false; // Cancellation flag for this effect instance

    const performAutoOutreach = async () => {
      // Check conditions to START auto outreach
      if (campaign.current_workflow_step === 'Creator Matching Complete' && 
          campaign.matched_influencers_data && 
          campaign.matched_influencers_data.length > 0 &&
          aiClient && // Ensure AI client is ready
          !isAutoProcessingStateRef.current // Ensure not already processing (using ref for latest value)
          ) {
        
        setIsAutoProcessing(true); // Signal that we are starting
        setAutoProcessingLog(prev => ['Starting automated outreach sequence...']);
        setError(null); // Clear previous general errors

        try {
          for (let i = 0; i < campaign.matched_influencers_data.length; i++) {
            const influencer = campaign.matched_influencers_data[i];
            
            if (didCancel || !isAutoProcessingStateRef.current) {
                logAutoProcessingEvent("Automation stopped during loop (detected pre-processing).");
                throw new Error("Auto-processing was cancelled or stopped.");
            }

            setCurrentProcessingInfluencerName(influencer.name);
            logAutoProcessingEvent(`[${i+1}/${campaign.matched_influencers_data.length}] Processing ${influencer.name}: Generating message...`);
            
            const message = await generateAIMessage(influencer);
            // No artificial delay here, generateAIMessage has its own processing time
            
            if (didCancel || !isAutoProcessingStateRef.current) {
                logAutoProcessingEvent(`Automation stopped for ${influencer.name} before sending.`);
                throw new Error("Auto-processing was cancelled or stopped before sending.");
            }
            await simulateSendMessage(influencer, message);
            // simulateSendMessage has its own delay
          }
          
          // After loop completes successfully
          if (didCancel || !isAutoProcessingStateRef.current) {
            logAutoProcessingEvent("Automation completed processing all influencers but was then stopped before final step.");
            throw new Error("Auto-processing completed loop but was stopped before final workflow advance.");
          }

          logAutoProcessingEvent('All influencers processed successfully.');
          await advanceWorkflowStep('Initial Outreach Complete', 'Outreach Sent', { 
            summary: `${campaign.matched_influencers_data.length} influencers contacted via automation.`, 
            brand_user_id: currentUserId 
          });

        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during auto-outreach.';
          const knownCancellationMessages = [
            "Auto-processing was cancelled or stopped.",
            "Auto-processing was cancelled or stopped before sending.",
            "Auto-processing completed loop but was stopped before final workflow advance."
          ];

          if (didCancel) { // Effect was cleaned up
            console.log('Automated outreach: Effect instance cancelled (didCancel=true). Last error (if any):', errorMessage);
            if (knownCancellationMessages.includes(errorMessage)) {
              logAutoProcessingEvent('Previous automation cycle was superseded or naturally concluded.');
            } else {
              // This means an actual error might have occurred just as it was cancelling
              logAutoProcessingEvent(`Note: A non-cancellation error might have occurred during effect cleanup: ${errorMessage}`);
            }
          } else { // Effect instance still active
            if (knownCancellationMessages.includes(errorMessage) && !isAutoProcessingStateRef.current) {
              // This means it was manually stopped via the button
              setError(null); 
              logAutoProcessingEvent('Automation was manually stopped by user.');
              console.log('Automated outreach: Manually stopped by user.');
              await logWorkflowStep(campaign.id, 'Automated Outreach Manually Stopped', { reason: 'User clicked stop button', brand_user_id: currentUserId }, 'info');
            } else {
              // Genuine error during active processing
              console.error('Error during active automated outreach:', err);
              setError(errorMessage); 
              logAutoProcessingEvent(`ERROR: ${errorMessage}`);
              await logWorkflowStep(campaign.id, 'Automated Outreach Failed', { error: errorMessage, brand_user_id: currentUserId }, 'failed');
            }
          }
        } finally {
          if (!didCancel) { // Only update state if the effect instance wasn't cancelled
            setIsAutoProcessing(false);
            setCurrentProcessingInfluencerName(null);
          }
        }
      }
    };
    
    performAutoOutreach();

    return () => { // Cleanup function for this specific effect instance
        didCancel = true;
        logAutoProcessingEvent("Outreach automation effect instance cleaning up...");
    };
  // Dependencies: These trigger the effect to re-run if they change.
  // campaign.id ensures it's specific to this campaign.
  // currentUserId included if logging depends on it directly within this effect.
  // aiClient ensures effect re-runs if AI client becomes available/changes.
  // advanceWorkflowStep, generateAIMessage, simulateSendMessage are stable due to useCallback.
  }, [
      campaign.id, // Ensures effect is tied to current campaign
      campaign.current_workflow_step, 
      campaign.matched_influencers_data, 
      advanceWorkflowStep, 
      generateAIMessage, 
      simulateSendMessage,
      aiClient, // Re-run if aiClient changes (e.g., initializes)
      currentUserId,
      logAutoProcessingEvent // Added because it's used inside
    ]);


  const handleManualGenerateMessage = async () => {
    if (!selectedInfluencerForManual) {
      setError("Please select an influencer for manual outreach.");
      return;
    }
    if (!aiClient) {
      setError(aiClientError || "Gemini API Client not available for manual message generation.");
      return;
    }
    setLoading(true);
    setError(null);
    setManualGeneratedMessage('');
    try {
      const message = await generateAIMessage(selectedInfluencerForManual);
      setManualGeneratedMessage(message);
    } catch (err) {
      console.error('Failed to generate manual outreach message:', err);
      setError(err instanceof Error ? err.message : 'An AI error occurred during message generation.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSimulateSend = async () => {
    if (!selectedInfluencerForManual || !manualGeneratedMessage) {
        setError("Please select an influencer and generate a message first for manual send.");
        return;
    }
    setLoading(true);
    setError(null);
    try {
        await simulateSendMessage(selectedInfluencerForManual, manualGeneratedMessage);
        alert(`Simulated sending message manually to ${selectedInfluencerForManual.name}`);
        setManualGeneratedMessage(''); // Clear after sending
        setSelectedInfluencerForManual(null); // Clear selection
        await logWorkflowStep(campaign.id, 'Manual Outreach Message Sent (Simulated)', { influencer_id:selectedInfluencerForManual.id, influencer_name: selectedInfluencerForManual.name, brand_user_id: currentUserId }, 'success');
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Error in manual simulated send.');
    } finally {
        setLoading(false);
    }
  };

  // Determine if outreach module should be active (either automated or manual tools available)
  const isOutreachPhase = campaign.current_workflow_step === 'Creator Matching Complete';
  const isOutreachActiveOrCompleted = campaign.current_workflow_step?.includes('Outreach') || campaign.status === 'Outreach Sent' || campaign.status === 'Completed';


  return (
    <div className="p-6 border border-gray-200 rounded-lg shadow">
      <h3 className="text-xl font-semibold text-gray-700 mb-4">2. Outreach & Negotiation</h3>
      
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {aiClientError && !aiClient && <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">{aiClientError}</div>}


      {isAutoProcessing && (
        <div className="mb-4 p-4 bg-indigo-50 rounded-lg shadow">
          <h4 className="text-md font-semibold text-indigo-700 mb-2">Automated Outreach In Progress...</h4>
          {currentProcessingInfluencerName && <p className="text-sm text-indigo-600">Currently processing: {currentProcessingInfluencerName}</p>}
          <div className="mt-2 max-h-40 overflow-y-auto bg-white p-2 border border-indigo-200 rounded">
            {autoProcessingLog.map((log, index) => (
              <p key={index} className="text-xs text-gray-600">{log}</p>
            ))}
          </div>
           <button 
             onClick={() => {
               // This directly sets the state, which isAutoProcessingStateRef will pick up.
               // The running loop should then see `!isAutoProcessingStateRef.current` as true.
               setIsAutoProcessing(false); 
               logAutoProcessingEvent("Stop button clicked by user. Attempting to halt automation...");
             }} 
             className="mt-3 text-xs bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded shadow"
           >
             Stop Automation
           </button>
        </div>
      )}

      {/* Show manual tools if automation is NOT running AND conditions are met */}
      {!isAutoProcessing && (
        <>
          {(!campaign.matched_influencers_data || campaign.matched_influencers_data.length === 0) && isOutreachPhase && (
            <p className="text-sm text-gray-500">No influencers matched yet. Complete creator matching first to enable outreach.</p>
          )}

          {campaign.matched_influencers_data && campaign.matched_influencers_data.length > 0 && (
            <>
              {isOutreachPhase && (
                <p className="text-sm text-green-700 bg-green-50 p-3 rounded mb-3">
                  Automated outreach will begin shortly for {campaign.matched_influencers_data.length} influencer(s) if not already started/completed. Manual tools below are optional.
                </p>
              )}
              {!isOutreachPhase && isOutreachActiveOrCompleted && (
                 <p className="text-sm text-blue-700 bg-blue-50 p-3 rounded mb-3">
                  Outreach phase status: {campaign.current_workflow_step}. Manual tools can be used for follow-ups.
                </p>
              )}
              {!isOutreachPhase && !isOutreachActiveOrCompleted && (
                 <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded mb-3">
                    Outreach phase not yet active. Complete previous steps.
                </p>
              )}


              <div className="mt-4 border-t pt-4">
                <h4 className="text-md font-semibold text-gray-600 mb-2">Manual Outreach Tools</h4>
                <div className="mb-4">
                  <label htmlFor="influencerSelectManual" className="block text-sm font-medium text-gray-700 mb-1">Select Influencer for Manual Outreach:</label>
                  <select 
                    id="influencerSelectManual"
                    value={selectedInfluencerForManual?.id || ''}
                    onChange={(e) => {
                      const infId = e.target.value;
                      setSelectedInfluencerForManual(campaign.matched_influencers_data?.find(inf => inf.id === infId) || null);
                      setManualGeneratedMessage(''); // Clear message on new selection
                      setError(null); // Clear errors
                    }}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white"
                  >
                    <option value="">-- Select an Influencer --</option>
                    {campaign.matched_influencers_data.map(inf => (
                      <option key={inf.id} value={inf.id}>{inf.name} ({inf.niche})</option>
                    ))}
                  </select>
                </div>

                {selectedInfluencerForManual && (
                  <div className="mt-4">
                    <button
                      onClick={handleManualGenerateMessage}
                      disabled={loading || !aiClient}
                      className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400 mr-2"
                    >
                      {loading && manualGeneratedMessage === '' ? 'Generating...' : `Generate Message for ${selectedInfluencerForManual.name}`}
                    </button>
                    {!aiClient && <p className="text-xs text-red-500 inline">{aiClientError || "AI Client not available."}</p>}

                    {manualGeneratedMessage && (
                      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
                        <h4 className="font-medium text-gray-700 mb-1">Generated Message Preview:</h4>
                        <textarea 
                          value={manualGeneratedMessage} 
                          onChange={(e) => setManualGeneratedMessage(e.target.value)}
                          rows={8}
                          className="w-full p-2 border border-gray-300 rounded text-sm bg-white" 
                        />
                        <button 
                          onClick={handleManualSimulateSend}
                          disabled={loading}
                          className="mt-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-3 rounded text-sm disabled:bg-gray-400"
                        >
                          {loading ? 'Sending...' : 'Simulate Manual Send'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default OutreachModule;