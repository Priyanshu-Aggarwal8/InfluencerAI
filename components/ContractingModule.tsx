

// components/ContractingModule.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Campaign,
    CampaignEnrollmentWithInfluencerProfile,
    updateCampaignEnrollmentDetails,
    logWorkflowStep,
    CampaignEnrollmentStatus // Import directly for clarity
} from '../services/dbService';
import { GoogleGenAI } from '@google/genai';

interface ContractingModuleProps {
  campaign: Campaign;
  enrollments: CampaignEnrollmentWithInfluencerProfile[]; // All enrollments for the campaign
  onEnrollmentUpdateOrStatusChange: () => void; // Callback to refresh data in parent
  currentUserId: string; // Brand's user ID
  advanceCampaignWorkflowStep: (stepName: string, status: string, details?: object) => Promise<void>;
}

const getStatusFriendlyName = (status: CampaignEnrollmentStatus | string): string => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Changed to named export
export const ContractingModule: React.FC<ContractingModuleProps> = ({
    campaign,
    enrollments,
    onEnrollmentUpdateOrStatusChange,
    currentUserId,
    advanceCampaignWorkflowStep
}) => {
  const [aiClient, setAiClient] = useState<GoogleGenAI | null>(null);
  const [aiClientError, setAiClientError] = useState<string | null>(null);

  const [selectedEnrollment, setSelectedEnrollment] = useState<CampaignEnrollmentWithInfluencerProfile | null>(null);
  const [deliverables, setDeliverables] = useState('');
  const [terms, setTerms] = useState('');
  const [contractDraft, setContractDraft] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptedEnrollments = enrollments.filter(e => 
    e.status === 'approved_by_creator' || 
    e.status === 'contract_drafting_by_brand' || 
    e.status === 'contract_pending_brand_send' || 
    e.status === 'contract_sent_to_creator'
  );

  useEffect(() => {
    try {
      const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY)
            ? process.env.API_KEY
            : (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY)
            ? import.meta.env.VITE_GEMINI_API_KEY
            : null;
      if (apiKey) {
        if (!aiClient) setAiClient(new GoogleGenAI({ apiKey }));
      } else {
        const warningMsg = "Gemini API Key not found. AI Contract drafting will be disabled. Set API_KEY or VITE_GEMINI_API_KEY.";
        console.warn(warningMsg);
        if (!aiClientError) setAiClientError(warningMsg);
      }
    } catch (e) {
      console.error("Error initializing GoogleGenAI for contracting:", e);
      if (!aiClientError) setAiClientError("Failed to initialize AI Client. Contract drafting disabled.");
    }
  }, [aiClient, aiClientError]);

  useEffect(() => {
    if (selectedEnrollment) {
      console.log('[ContractingModule] Selected Enrollment Data (on selection change):', JSON.stringify(selectedEnrollment, null, 2));
      
      setDeliverables(selectedEnrollment.deliverables || '');
      setTerms(selectedEnrollment.terms_and_conditions || '');
      setContractDraft(selectedEnrollment.contract_final_version || selectedEnrollment.contract_draft_v1 || '');
      setError(null);
    } else {
      setDeliverables('');
      setTerms('');
      setContractDraft('');
    }
  }, [selectedEnrollment]);

  const getInfluencerNameFromEnrollment = useCallback((enrollment: CampaignEnrollmentWithInfluencerProfile | null): string => {
    console.log('[getInfluencerNameFromEnrollment] Input enrollment data:', JSON.stringify(enrollment, null, 2));

    if (!enrollment) {
      console.warn('[getInfluencerNameFromEnrollment] Fallback: Enrollment not provided');
      return 'the Influencer (Enrollment N/A)';
    }

    // Primary way: using structured profile data
    if (enrollment.profile_data?.influencer_profile?.name && enrollment.profile_data.influencer_profile.name.trim() !== '') {
      return enrollment.profile_data.influencer_profile.name;
    }
    if (enrollment.profile_data?.full_name && enrollment.profile_data.full_name.trim() !== '') {
      console.warn('[getInfluencerNameFromEnrollment] Using profile_data.full_name as influencer_profile.name was missing. Enrollment ID:', enrollment.id);
      return enrollment.profile_data.full_name;
    }

    // Last-resort fallback: Try to parse from offer_details.message (e.g., "Hi [Influencer Name], ...")
    // This is a HACK and indicates a data fetching/schema issue if reached.
    if (enrollment.offer_details?.message && typeof enrollment.offer_details.message === 'string') {
      const match = enrollment.offer_details.message.match(/^Hi\s+([^,]+),/);
      if (match && match[1]) {
        console.warn(`[getInfluencerNameFromEnrollment] HACK: Parsed name "${match[1]}" from offer_details.message. Profile data is missing or incomplete for enrollment ID: ${enrollment.id}. PLEASE FIX SUPABASE SCHEMA/QUERY.`);
        return match[1];
      }
    }
    
    // If all else fails:
    let problemDetail = "Name Unknown";
    if (!enrollment.profile_data) problemDetail = "Profile Data Missing";
    else if (!enrollment.profile_data.influencer_profile) problemDetail = "Influencer Details Missing";
    else if (!enrollment.profile_data.influencer_profile.name) problemDetail = "Name Not Set in Profile";
    
    console.warn(`[getInfluencerNameFromEnrollment] Fallback: Could not determine influencer name. Problem: ${problemDetail}. Enrollment ID: ${enrollment.id}`);
    return `the Influencer (${problemDetail})`;
  }, []);


  const handleGenerateContract = async () => {
    if (!selectedEnrollment || !aiClient) {
      setError("Select an influencer and ensure AI Client is ready.");
      return;
    }
    if (!deliverables.trim() || !terms.trim()) {
      setError("Please define Deliverables and Terms & Conditions before generating a contract.");
      return;
    }
    setLoading(true);
    setError(null);
    const influencerName = getInfluencerNameFromEnrollment(selectedEnrollment);
    const prompt = `Draft a concise influencer marketing contract for a campaign titled "${campaign.name}".
Campaign Goals: "${campaign.goals || 'General promotion'}".
Brand: [Brand Company Name Placeholder]
Influencer: ${influencerName}

Key Deliverables:
${deliverables}

Terms and Conditions:
${terms}

The contract should include sections for: Parties, Scope of Work (based on deliverables), Content Ownership, Usage Rights, Compensation (mention campaign budget of ${campaign.budget ? `$${campaign.budget}` : 'to be specified based on overall campaign budget'}), Confidentiality, Term and Termination, and Governing Law.
Keep it professional and clear. Use placeholders like [Date], [Brand Signature], [Influencer Signature].
Limit to approximately 300-400 words.`;

    try {
      console.log("[ContractingModule] Generating AI contract with prompt for:", influencerName);
      const response = await aiClient.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      setContractDraft(response.text);
      console.log("[ContractingModule] AI contract generated successfully for:", influencerName);
      await logWorkflowStep(campaign.id, 'AI Contract Draft Generated', { influencer_user_id: selectedEnrollment.influencer_user_id, influencer_name: influencerName, enrollment_id: selectedEnrollment.id, brand_user_id: currentUserId }, 'success');
    } catch (err) {
      console.error("[ContractingModule] Failed to generate AI contract for:", influencerName, err);
      setError(err instanceof Error ? err.message : "AI contract generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedEnrollment) {
      setError("No influencer enrollment selected to save draft for.");
      return;
    }
    setLoading(true);
    setError(null);
    const influencerName = getInfluencerNameFromEnrollment(selectedEnrollment);
    console.log("[ContractingModule] Saving contract draft for enrollment ID:", selectedEnrollment.id, "Influencer:", influencerName);
    try {
      await updateCampaignEnrollmentDetails(
        selectedEnrollment.id,
        {
          deliverables: deliverables || null,
          terms_and_conditions: terms || null,
          contract_draft_v1: contractDraft || null,
          status: 'contract_drafting_by_brand'
        },
        currentUserId
      );
      await logWorkflowStep(campaign.id, 'Contract Draft Saved', { influencer_user_id: selectedEnrollment.influencer_user_id, enrollment_id: selectedEnrollment.id, influencer_name: influencerName, brand_user_id: currentUserId }, 'info');
      onEnrollmentUpdateOrStatusChange(); 
      alert('Contract draft saved successfully!');
      console.log("[ContractingModule] Contract draft saved for:", influencerName);
    } catch (err) {
      console.error("[ContractingModule] Failed to save contract draft for:", influencerName, err);
      setError(err instanceof Error ? err.message : "Failed to save contract draft. Check console and RLS policies.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeAndSend = async () => {
    console.log("%c[ContractingModule:handleFinalizeAndSend] Function STALLED.", "color: orange; font-weight: bold;");
    console.log("[ContractingModule:handleFinalizeAndSend] Selected Enrollment ID:", selectedEnrollment ? selectedEnrollment.id : "None");
    console.log("[ContractingModule:handleFinalizeAndSend] Contract Draft (first 50 chars):", contractDraft.substring(0,50));

    if (!selectedEnrollment || !contractDraft.trim()) {
        const msg = "Please ensure an influencer is selected and a contract is drafted before finalizing.";
        console.error("[ContractingModule:handleFinalizeAndSend] VALIDATION FAILED:", msg);
        setError(msg);
        return;
    }

    const influencerName = getInfluencerNameFromEnrollment(selectedEnrollment);
    if (!window.confirm(`This will finalize the contract for ${influencerName} and mark it as sent (simulated). Proceed?`)) {
        console.log("[ContractingModule:handleFinalizeAndSend] User cancelled operation.");
        return;
    }
    
    setLoading(true);
    setError(null);
    console.log(`%c[ContractingModule:handleFinalizeAndSend] STARTING PROCESS for: ${influencerName}, Enrollment ID: ${selectedEnrollment.id}`, "color: blue; font-weight: bold;");

    try {
        // STEP 1: Update Enrollment Details
        console.log("[ContractingModule:handleFinalizeAndSend] STEP 1: Calling updateCampaignEnrollmentDetails...");
        console.log("[ContractingModule:handleFinalizeAndSend] STEP 1 Data:", {
            enrollmentId: selectedEnrollment.id,
            updates: {
                deliverables: deliverables || null,
                terms_and_conditions: terms || null,
                contract_final_version: contractDraft, 
                status: 'contract_sent_to_creator'
            },
            currentUserId
        });
        const updatedEnrollment = await updateCampaignEnrollmentDetails(
            selectedEnrollment.id,
            {
                deliverables: deliverables || null,
                terms_and_conditions: terms || null,
                contract_final_version: contractDraft, 
                status: 'contract_sent_to_creator'
            },
            currentUserId
        );
        console.log("%c[ContractingModule:handleFinalizeAndSend] STEP 1 SUCCESS: updateCampaignEnrollmentDetails successful.", "color: green;", updatedEnrollment);

        // STEP 2: Log specific workflow step for this enrollment
        console.log("[ContractingModule:handleFinalizeAndSend] STEP 2: Logging 'Contract Sent to Creator (Simulated)' workflow step...");
        const logDetails = { 
            influencer_user_id: selectedEnrollment.influencer_user_id, 
            influencer_name: influencerName, 
            enrollment_id: selectedEnrollment.id, 
            brand_user_id: currentUserId, 
            contract_content_preview: contractDraft.substring(0,100)+"..." 
        };
        console.log("[ContractingModule:handleFinalizeAndSend] STEP 2 LogData:", logDetails);
        await logWorkflowStep( campaign.id, 'Contract Sent to Creator (Simulated)', logDetails, 'success');
        console.log("%c[ContractingModule:handleFinalizeAndSend] STEP 2 SUCCESS: Workflow step logged.", "color: green;");

        // STEP 3: Determine and advance overall campaign workflow
        const updatedEnrollmentsAfterThisOne = enrollments.map(e => 
            e.id === selectedEnrollment.id 
            ? { ...e, status: 'contract_sent_to_creator' as CampaignEnrollmentStatus, contract_final_version: contractDraft, deliverables, terms_and_conditions: terms } 
            : e
        );
        const allAcceptedNowHaveContractsSent = updatedEnrollmentsAfterThisOne
            .filter(e => ['approved_by_creator', 'contract_drafting_by_brand', 'contract_pending_brand_send', 'contract_sent_to_creator'].includes(e.status))
            .every(e => e.status === 'contract_sent_to_creator');
        
        const advanceDetailsBase = {
             summary: `Contract finalized and marked as sent (simulated) to ${influencerName}.`,
             last_action_enrollment_id: selectedEnrollment.id,
             last_action_influencer_name: influencerName,
             brand_user_id: currentUserId 
        };
        
        console.log("[ContractingModule:handleFinalizeAndSend] STEP 3: Determining campaign workflow advancement. All contracts sent for accepted creators?", allAcceptedNowHaveContractsSent);
        if(allAcceptedNowHaveContractsSent) {
            const finalAdvanceDetails = { ...advanceDetailsBase, overall_status_note: `All accepted creators (${updatedEnrollmentsAfterThisOne.filter(e => e.status === 'contract_sent_to_creator').length}) have now been sent contracts (simulated).` };
            console.log("[ContractingModule:handleFinalizeAndSend] Advancing campaign to 'Contracts Sent'. Details:", finalAdvanceDetails);
            await advanceCampaignWorkflowStep('Contracts Sent', 'Contracting Complete', finalAdvanceDetails);
        } else {
            const partialAdvanceDetails = { ...advanceDetailsBase, overall_status_note: `Contract for ${influencerName} sent (simulated). Other contracts may still be pending for other accepted creators.` };
            console.log("[ContractingModule:handleFinalizeAndSend] Advancing campaign to 'Contracting In Progress'. Details:", partialAdvanceDetails);
            await advanceCampaignWorkflowStep('Contracting In Progress', 'Contracting', partialAdvanceDetails);
        }
        console.log("%c[ContractingModule:handleFinalizeAndSend] STEP 3 SUCCESS: Campaign workflow step advanced.", "color: green;");

        onEnrollmentUpdateOrStatusChange(); 
        alert(`Contract finalized and marked as sent to ${influencerName}! This is a simulated send; no actual email/message was dispatched.`);
        console.log(`%c[ContractingModule:handleFinalizeAndSend] OVERALL SUCCESS for ${influencerName}`, "color: green; font-weight: bold;");
        setSelectedEnrollment(null); 
    } catch (err) {
        console.error("%c[ContractingModule:handleFinalizeAndSend] OVERALL CRITICAL ERROR during process.", "color: red; font-weight: bold;");
        console.error("[ContractingModule:handleFinalizeAndSend] Raw error object:", err);
        console.error("[ContractingModule:handleFinalizeAndSend] Error (stringified for details):", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));

        const errorMsg = err instanceof Error ? err.message : "An unknown error occurred.";
        // Log the error to the server for backend diagnosis if possible
        try {
            await logWorkflowStep(campaign.id, 'Contract Finalize/Send Failed', { 
                error: errorMsg, 
                enrollment_id_attempted: selectedEnrollment.id,
                influencer_name_attempted: influencerName,
                details_at_failure: JSON.stringify(err, Object.getOwnPropertyNames(err), 2).substring(0, 500) // Limit length
            }, 'failed');
        } catch (logErr) {
            console.error("[ContractingModule:handleFinalizeAndSend] Failed to log the main error to workflow_logs:", logErr);
        }
        setError(`Failed to finalize and send contract. Error: ${errorMsg}. Check console for full details and ensure Supabase RLS policies are correct for 'campaign_enrollments' (update), 'workflow_logs' (insert), and 'campaigns' (update).`);
    } finally {
        setLoading(false);
        console.log("%c[ContractingModule:handleFinalizeAndSend] Function FINISHED.", "color: orange; font-weight: bold;");
    }
  };

  if (acceptedEnrollments.length === 0) {
     if (!['Campaign Created', 'Creator Matching Complete', 'Initial Outreach Complete', 'Creator Offers Sent'].includes(campaign.current_workflow_step || '')) {
        return <p className="text-sm text-gray-500 my-3 p-6 border border-gray-200 rounded-lg shadow mt-6">No creators have accepted offers for this campaign yet, or contracting is complete for all accepted.</p>;
     }
     if (['Creator Offers Sent', 'Initial Outreach Complete'].includes(campaign.current_workflow_step || '')) {
         return <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded my-3 p-6 border border-gray-200 shadow mt-6">Offers have been sent. Waiting for creators to respond before contracts can be managed.</p>;
     }
     return null; 
  }


  return (
    <div className="p-6 border border-gray-200 rounded-lg shadow mt-6">
      <h3 className="text-xl font-semibold text-gray-700 mb-4">3. Contracting & Agreements</h3>
      {aiClientError && <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4 text-sm">{aiClientError}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm" role="alert">{error}</div>}

      <div className="mb-4">
        <label htmlFor="influencerContractSelect" className="block text-sm font-medium text-gray-700 mb-1">
          Select Creator for Contract:
        </label>
        <select
          id="influencerContractSelect"
          value={selectedEnrollment?.id || ''}
          onChange={(e) => {
            const enrollment = acceptedEnrollments.find(enr => enr.id === e.target.value) || null;
            setSelectedEnrollment(enrollment);
          }}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white"
          aria-label="Select creator for contract"
        >
          <option value="">-- Select Creator --</option>
          {acceptedEnrollments.map(enr => (
            <option key={enr.id} value={enr.id}>
              {getInfluencerNameFromEnrollment(enr)} ({enr.status === 'contract_sent_to_creator' ? 'Contract Sent' : getStatusFriendlyName(enr.status)})
            </option>
          ))}
        </select>
      </div>

      {selectedEnrollment && selectedEnrollment.status !== 'contract_sent_to_creator' && (
        <div className="space-y-4 mt-4 border-t pt-4">
          <h4 className="text-md font-semibold text-gray-600">
            Define Contract for: <span className="font-bold text-indigo-700">{getInfluencerNameFromEnrollment(selectedEnrollment)}</span>
          </h4>
          <div>
            <label htmlFor="deliverables" className="block text-sm font-medium text-gray-700">Deliverables *</label>
            <textarea
              id="deliverables"
              rows={3}
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
              placeholder="e.g., 2 Instagram posts, 1 Reel, 3 Stories. Mention specific content requirements..."
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="terms" className="block text-sm font-medium text-gray-700">Additional Terms & Conditions *</label>
            <textarea
              id="terms"
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
              placeholder="e.g., Exclusivity period, payment schedule, approval process, usage rights details..."
              aria-required="true"
            />
          </div>
          <button
            onClick={handleGenerateContract}
            disabled={loading || !aiClient || !deliverables.trim() || !terms.trim()}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
            type="button"
          >
            {loading && contractDraft === '' ? 'Generating...' : 'Draft Contract with AI'}
          </button>
          {!aiClient && <p className="text-xs text-red-500 inline ml-2">{aiClientError || "AI Client not available."}</p>}

          {contractDraft && (
            <div className="mt-4">
              <label htmlFor="contractDraft" className="block text-sm font-medium text-gray-700">Contract Draft (Editable)</label>
              <textarea
                id="contractDraft"
                rows={15}
                value={contractDraft}
                onChange={(e) => setContractDraft(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white font-mono text-xs"
                aria-label="Contract draft text area"
              />
            </div>
          )}
          <div className="flex space-x-3 mt-4">
            <button
              onClick={handleSaveDraft}
              disabled={loading || !contractDraft.trim()}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-300"
              type="button"
            >
              {loading ? 'Saving...' : 'Save Contract Draft'}
            </button>
            <button
              onClick={handleFinalizeAndSend}
              disabled={loading || !contractDraft.trim()}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:bg-green-300"
              type="button"
            >
              {loading ? 'Finalizing...' : 'Finalize & Send to Creator'}
            </button>
          </div>
        </div>
      )}
      {selectedEnrollment && selectedEnrollment.status === 'contract_sent_to_creator' && (
         <div className="mt-4 p-4 bg-green-50 border border-green-300 rounded-md">
            <h4 className="text-md font-semibold text-green-700">Contract Sent!</h4>
            <p className="text-sm text-green-600">The contract has been finalized and marked as sent to <span className="font-bold">{getInfluencerNameFromEnrollment(selectedEnrollment)}</span>.</p>
            <p className="text-xs text-gray-500 mt-2">Final Contract Content (Simulated Send):</p>
            <pre className="text-xs bg-white p-2 border border-gray-200 rounded mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap">
                {selectedEnrollment.contract_final_version || "No final contract content stored."}
            </pre>
         </div>
      )}
    </div>
  );
};
