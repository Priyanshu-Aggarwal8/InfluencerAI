// components/CampaignDetailView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
    Campaign, 
    updateCampaign, 
    logWorkflowStep, 
    WorkflowLog, 
    getWorkflowLogs,
    getEnrollmentsForCampaign, 
    CampaignEnrollmentWithInfluencerProfile 
} from '../services/dbService';
import CreatorMatchingModule from './CreatorMatchingModule';
import OutreachModule from './OutreachModule';
import { ContractingModule } from './ContractingModule'; 
import WorkflowLogDisplay from './WorkflowLogDisplay';
import { WorkflowStepperNav } from './WorkflowStepperNav'; // New Import

interface CampaignDetailViewProps {
  campaign: Campaign;
  onBack: () => void;
  onCampaignUpdate: () => void; 
  currentUserId: string;
}

const SIMULATED_PROCESSING_DELAY = 1500; 

const CampaignDetailView: React.FC<CampaignDetailViewProps> = ({ campaign: initialCampaign, onBack, onCampaignUpdate, currentUserId }) => {
  const [campaign, setCampaign] = useState<Campaign>(initialCampaign);
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState<string | null>(null);
  const [workflowLogs, setWorkflowLogs] = useState<WorkflowLog[]>([]);
  const [campaignEnrollments, setCampaignEnrollments] = useState<CampaignEnrollmentWithInfluencerProfile[]>([]); 
  const [loadingEnrollments, setLoadingEnrollments] = useState(false); 

  const [autoSystemProcessing, setAutoSystemProcessing] = useState(false);
  const [autoSystemMessage, setAutoSystemMessage] = useState<string | null>(null);
  const [showPerformanceReport, setShowPerformanceReport] = useState(false);


  useEffect(() => {
    setCampaign(initialCampaign); 
  }, [initialCampaign]);

  const fetchCampaignSubData = useCallback(async () => {
    if (!campaign || !campaign.id) return;
    setError(null); 
    setLoadingEnrollments(true);
    try {
      const [logs, enrollments] = await Promise.all([
        getWorkflowLogs(campaign.id),
        getEnrollmentsForCampaign(campaign.id)
      ]);
      setWorkflowLogs(logs || []);
      setCampaignEnrollments(enrollments || []);
    } catch (err) {
      console.error("Failed to fetch campaign sub-data (logs/enrollments)", err);
      const errorMsg = err instanceof Error ? err.message : "Could not load campaign details.";
      setError(prevError => prevError || errorMsg); 
    } finally {
      setLoadingEnrollments(false);
    }
  }, [campaign]);

  useEffect(() => {
    fetchCampaignSubData();
  }, [fetchCampaignSubData]);


  const handleCampaignDataUpdate = (updatedCampaignData: Campaign) => {
    setCampaign(updatedCampaignData); 
    onCampaignUpdate(); 
    fetchCampaignSubData(); 
  };
  
  const handleEnrollmentOrWorkflowUpdate = () => {
    onCampaignUpdate(); 
    fetchCampaignSubData(); 
  }


  const advanceWorkflowStepAndLogInternal = useCallback(async (stepName: string, status: string, details?: object, isAutoSystem: boolean = false): Promise<Campaign> => {
    if (isAutoSystem) {
      setAutoSystemProcessing(true);
      setAutoSystemMessage(`Simulating: ${stepName}...`);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      if(isAutoSystem) await new Promise(resolve => setTimeout(resolve, 100));

      const updatedCampaignArray = await updateCampaign(campaign.id, { current_workflow_step: stepName, status: status });
      
      if (updatedCampaignArray && updatedCampaignArray.length > 0 && updatedCampaignArray[0]) {
        const updatedCamp = updatedCampaignArray[0];
        setCampaign(updatedCamp); 
        await logWorkflowStep(campaign.id, stepName, {...details, brand_user_id_context: currentUserId }, "success");
        handleEnrollmentOrWorkflowUpdate(); 
        return updatedCamp;
      } else {
        throw new Error("Failed to receive updated campaign data after advancing workflow.");
      }
    } catch (err) {
      console.error(`Failed to advance workflow to ${stepName}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Error advancing to ${stepName}.`;
      setError(errorMessage);
      await logWorkflowStep(campaign.id, stepName, { error: errorMessage, brand_user_id_context: currentUserId }, "failed");
      throw err; 
    } finally {
      if (isAutoSystem) {
        setAutoSystemProcessing(false);
        setAutoSystemMessage(null);
      } else {
        setLoading(false);
      }
    }
  }, [campaign.id, handleEnrollmentOrWorkflowUpdate, currentUserId]); 

  const propCompatibleAdvanceWorkflowStep = useCallback(async (stepName: string, status: string, details?: object): Promise<void> => {
    try {
      await advanceWorkflowStepAndLogInternal(stepName, status, details, false);
    } catch (err) {
      console.log("propCompatibleAdvanceWorkflowStep caught an error (already handled).");
    } 
  }, [advanceWorkflowStepAndLogInternal]);


  useEffect(() => {
    const autoProgress = async () => {
      if (autoSystemProcessing || !campaign.current_workflow_step) return; 

      const hasPendingContracts = campaignEnrollments.some(e => e.status === 'approved_by_creator');
      if (hasPendingContracts && (campaign.current_workflow_step === 'Initial Outreach Complete' || campaign.current_workflow_step === 'Creator Offers Sent')) {
          console.log("Auto-progression paused: Pending brand action for accepted creator contracts.");
          return;
      }

      let currentCamp = campaign; 

      try {
         if (currentCamp.current_workflow_step === 'Contracts Sent' || currentCamp.current_workflow_step === 'Contracting Complete') { 
          await new Promise(resolve => setTimeout(resolve, SIMULATED_PROCESSING_DELAY / 2));
          currentCamp = await advanceWorkflowStepAndLogInternal('Contracts Signed (Simulated)', 'Contracts Signed', { detail: "System auto-simulated contract signing by creators." }, true);
        }
        
        if (currentCamp.current_workflow_step === 'Contracts Signed (Simulated)') {
          await new Promise(resolve => setTimeout(resolve, SIMULATED_PROCESSING_DELAY / 2));
          currentCamp = await advanceWorkflowStepAndLogInternal('Payment Processing (Simulated)', 'Payment Initiated', { detail: "System auto-initiated payment." }, true);

          if (currentCamp.current_workflow_step === 'Payment Processing (Simulated)') {
            await new Promise(resolve => setTimeout(resolve, SIMULATED_PROCESSING_DELAY));
            currentCamp = await advanceWorkflowStepAndLogInternal('Payment Processed (Simulated)', 'Payment Complete', { detail: "System auto-simulated payment completion." }, true);
          }
        }
        
        if (currentCamp.current_workflow_step === 'Payment Processed (Simulated)') {
           await new Promise(resolve => setTimeout(resolve, SIMULATED_PROCESSING_DELAY / 2));
           currentCamp = await advanceWorkflowStepAndLogInternal('Performance Reporting (Simulated)', 'Report Generating', { detail: "System auto-generating performance report." }, true);

           if (currentCamp.current_workflow_step === 'Performance Reporting (Simulated)') {
            await new Promise(resolve => setTimeout(resolve, SIMULATED_PROCESSING_DELAY));
            await advanceWorkflowStepAndLogInternal('Reporting Complete (Simulated)', 'Completed', { detail: "System auto-simulated reporting completion." }, true);
           }
        }
      } catch (error) {
        console.error("Auto-progression sequence halted due to an error:", error);
      }
    };

    const triggerStepsForAutoSim = [
      'Contracts Sent', 
      'Contracting Complete',
      'Contracts Signed (Simulated)', 
      'Payment Processed (Simulated)',
    ];

    if (campaign.current_workflow_step && 
        triggerStepsForAutoSim.includes(campaign.current_workflow_step) && 
        !autoSystemProcessing) {
      autoProgress();
    }
  }, [campaign, advanceWorkflowStepAndLogInternal, autoSystemProcessing, campaignEnrollments]);

  const performanceReportLog = workflowLogs.find(log => log.step_name === 'Reporting Complete (Simulated)' || log.step_name === 'Performance Reporting (Simulated)');

  return (
    <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-800">{campaign.name}</h1>
        <button 
          onClick={onBack}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          &larr; Back to Dashboard
        </button>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">{error}</div>}
      {(loading || autoSystemProcessing || loadingEnrollments) && 
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4" role="status">
          {autoSystemMessage || (loadingEnrollments ? 'Loading campaign data...' : loading ? 'Processing your request...' : 'System is processing...')}
        </div>
      }

      {/* Workflow Stepper Nav */}
      <WorkflowStepperNav 
        workflowLogs={workflowLogs} 
        currentWorkflowStep={campaign.current_workflow_step}
        campaignStatus={campaign.status}
      />


      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="col-span-1 md:col-span-2">
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Campaign Details</h3>
          <p className="text-gray-600 mb-1"><strong className="font-medium">Status:</strong> <span className="font-semibold text-blue-600">{campaign.status}</span></p>
          <p className="text-gray-600 mb-1"><strong className="font-medium">Current Step:</strong> {campaign.current_workflow_step}</p>
          <p className="text-gray-600 mb-1"><strong className="font-medium">Campaign Tag:</strong> {campaign.campaign_tag || 'N/A'}</p>
          <p className="text-gray-600 mb-1"><strong className="font-medium">Description:</strong> {campaign.description}</p>
          <p className="text-gray-600 mb-1"><strong className="font-medium">Budget:</strong> {campaign.budget ? `$${campaign.budget}` : 'N/A'}</p>
          <p className="text-gray-600 mb-4"><strong className="font-medium">Goals:</strong> {campaign.goals || 'N/A'}</p>
        </div>
        <div className="col-span-1 text-sm text-gray-500">
            <p><strong>ID:</strong> {campaign.id}</p>
            <p><strong>Brand Owner ID:</strong> {campaign.user_id}</p> 
            <p><strong>Created:</strong> {new Date(campaign.created_at).toLocaleString()}</p>
        </div>
      </div>
      
      <div className="space-y-8">
        <CreatorMatchingModule 
            campaign={campaign} 
            onCampaignUpdate={handleCampaignDataUpdate} 
            advanceWorkflowStep={propCompatibleAdvanceWorkflowStep} 
            currentUserId={currentUserId}
        />

        {(campaign.current_workflow_step === 'Creator Offers Sent' || campaign.current_workflow_step === 'Creator Matching Complete') && campaign.matched_influencers_data && campaign.matched_influencers_data.length > 0 && (
          <OutreachModule 
            campaign={campaign} 
            onCampaignUpdate={handleCampaignDataUpdate}
            advanceWorkflowStep={propCompatibleAdvanceWorkflowStep} 
            currentUserId={currentUserId}
          />
        )}
        
        {(campaign.current_workflow_step?.includes('Offers Sent') || 
          campaign.current_workflow_step?.includes('Outreach Complete') || 
          campaign.current_workflow_step?.includes('Contracting') || 
          campaignEnrollments.some(e => e.status === 'approved_by_creator')) && (
            <ContractingModule
                campaign={campaign}
                enrollments={campaignEnrollments}
                onEnrollmentUpdateOrStatusChange={handleEnrollmentOrWorkflowUpdate}
                currentUserId={currentUserId}
                advanceCampaignWorkflowStep={propCompatibleAdvanceWorkflowStep}
            />
        )}
        
        {(campaign.current_workflow_step === 'Contracts Sent' ||
          campaign.current_workflow_step === 'Contracting Complete' || 
          campaign.current_workflow_step === 'Contracts Signed (Simulated)') && (
            <div className="p-4 border border-gray-200 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Post-Contracting Phase (Simulated)</h3>
                <p className="text-gray-500 text-sm mb-1">Status: {campaign.current_workflow_step === 'Contracts Signed (Simulated)' ? 'Contracts Signed (Simulated)' : 'Awaiting Simulated Signatures...'}</p>
            </div>
        )}

         {(campaign.current_workflow_step === 'Contracts Signed (Simulated)' ||
           campaign.current_workflow_step === 'Payment Processing (Simulated)' ||
           campaign.current_workflow_step === 'Payment Processed (Simulated)') && (
            <div className="p-4 border border-gray-200 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Payment Integration (Simulated)</h3>
                 <p className="text-gray-500 text-sm mb-1">Status: {campaign.current_workflow_step === 'Payment Processing (Simulated)' ? 'Processing Payment (Simulated)...' : campaign.current_workflow_step === 'Payment Processed (Simulated)' ? 'Payment Complete (Simulated)' : 'Pending Initiation'}</p>
            </div>
        )}
        
        {(campaign.current_workflow_step === 'Payment Processed (Simulated)' ||
          campaign.current_workflow_step === 'Performance Reporting (Simulated)' ||
          campaign.current_workflow_step === 'Reporting Complete (Simulated)') && ( 
            <div className="p-4 border border-gray-200 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Performance Reporting (Simulated)</h3>
                <p className="text-gray-500 text-sm mb-1">Status: {campaign.current_workflow_step === 'Performance Reporting (Simulated)' ? 'Generating Report (Simulated)...' : campaign.current_workflow_step === 'Reporting Complete (Simulated)' ? 'Report Complete (Simulated)' : 'Pending Initiation'}</p>
                 { (campaign.status === 'Completed' || campaign.current_workflow_step === 'Reporting Complete (Simulated)') &&
                    <button 
                        onClick={() => setShowPerformanceReport(prev => !prev)}
                        className="mt-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-1.5 px-3 rounded text-sm"
                    >
                        {showPerformanceReport ? 'Hide' : 'View'} Performance Report (Simulated)
                    </button>
                 }
            </div>
        )}

         {showPerformanceReport && performanceReportLog && (
            <div className="p-4 mt-4 bg-gray-50 border border-gray-200 rounded-lg shadow">
                <h4 className="text-md font-semibold text-gray-700 mb-2">Simulated Performance Report Details:</h4>
                <p className="text-sm text-gray-600"><strong>Log Step:</strong> {performanceReportLog.step_name}</p>
                <p className="text-sm text-gray-600"><strong>Logged At:</strong> {new Date(performanceReportLog.created_at).toLocaleString()}</p>
                {performanceReportLog.details && (
                    <pre className="text-xs text-gray-500 bg-white p-2 border rounded mt-1 overflow-x-auto">
                        {JSON.stringify(performanceReportLog.details, null, 2)}
                    </pre>
                )}
                 {!performanceReportLog.details && <p className="text-sm text-gray-500">No specific details logged for this simulated report.</p>}
            </div>
        )}

         {campaign.status === 'Completed' && (
            <div className="p-6 bg-green-50 border-green-200 rounded-lg shadow text-center">
                <h3 className="text-2xl font-semibold text-green-700 mb-2">🎉 Campaign Completed! 🎉</h3>
                <p className="text-green-600">This campaign has successfully run through all workflow stages.</p>
            </div>
        )}

        <WorkflowLogDisplay logs={workflowLogs} />
      </div>
    </div>
  );
};

export default CampaignDetailView;