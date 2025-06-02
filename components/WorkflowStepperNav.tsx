// components/WorkflowStepperNav.tsx
import React from 'react';
import { WorkflowLog } from '../services/dbService';

interface WorkflowStepperNavProps {
  workflowLogs: WorkflowLog[];
  currentWorkflowStep?: string | null;
  campaignStatus?: string | null; // To handle the overall 'Completed' status
}

const CANONICAL_WORKFLOW_STEPS = [
  { key: 'Campaign Created', label: 'Campaign Setup' },
  { key: 'Creator Matching Complete', label: 'Matching' }, // Can be skipped if offers sent directly
  { key: 'Creator Offers Sent', label: 'Offers Sent' },
  { key: 'Initial Outreach Complete', label: 'Outreach' }, // Often follows offers
  { key: 'Contracting In Progress', label: 'Contracting' }, // General contracting phase
  { key: 'Contracts Sent', label: 'Contracts Out' }, // All active contracts sent
  { key: 'Contracts Signed (Simulated)', label: 'Contracts Signed' },
  { key: 'Payment Processing (Simulated)', label: 'Payment Processing' },
  { key: 'Payment Processed (Simulated)', label: 'Payment Complete' },
  { key: 'Performance Reporting (Simulated)', label: 'Reporting' },
  { key: 'Reporting Complete (Simulated)', label: 'Done' } // This step might imply campaign completion
];

export const WorkflowStepperNav: React.FC<WorkflowStepperNavProps> = ({ workflowLogs, currentWorkflowStep, campaignStatus }) => {
  
  const getStepStatus = (stepKey: string, stepLabel: string) => {
    const logEntry = workflowLogs.find(log => log.step_name === stepKey && log.status === 'success');
    
    if (logEntry) return 'completed';
    if (stepKey === currentWorkflowStep) return 'current';
    
    // Inferring completion for steps that might not have explicit 'success' logs but are prerequisites for current step
    const currentIndex = CANONICAL_WORKFLOW_STEPS.findIndex(s => s.key === currentWorkflowStep);
    const stepIndex = CANONICAL_WORKFLOW_STEPS.findIndex(s => s.key === stepKey);

    if (currentIndex !== -1 && stepIndex < currentIndex) {
        // If a previous step doesn't have a direct success log, but a later step is current,
        // assume the previous one is "implicitly" completed.
        // This is a heuristic and might need refinement based on actual log patterns.
        // For a more robust system, every step taken should have a success log.
        const hasAnyLog = workflowLogs.some(log => log.step_name === stepKey);
        if (hasAnyLog) return 'completed'; // If any log exists, and it's before current, assume complete
    }

    // Special handling for overall campaign completion
    if (campaignStatus === 'Completed' && stepKey === 'Reporting Complete (Simulated)') {
        return 'completed';
    }


    return 'pending';
  };

  return (
    <div className="mb-8 p-4 border border-gray-200 rounded-lg shadow bg-gray-50 overflow-x-auto">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">Campaign Progress</h3>
      <nav aria-label="Workflow Progress">
        <ol className="flex items-center space-x-2 sm:space-x-4 text-sm font-medium">
          {CANONICAL_WORKFLOW_STEPS.map((step, index) => {
            const status = getStepStatus(step.key, step.label);
            let statusClasses = '';
            let dotClasses = '';
            let textClasses = '';

            switch (status) {
              case 'completed':
                statusClasses = 'border-green-500 text-green-600';
                dotClasses = 'bg-green-500';
                textClasses = 'text-green-700 font-semibold';
                break;
              case 'current':
                statusClasses = 'border-blue-500 text-blue-600 ring-2 ring-blue-300';
                dotClasses = 'bg-blue-500 ring-4 ring-blue-200';
                textClasses = 'text-blue-700 font-bold';
                break;
              default: // pending
                statusClasses = 'border-gray-300 text-gray-400';
                dotClasses = 'bg-gray-300';
                textClasses = 'text-gray-500';
                break;
            }

            return (
              <li key={step.key} className="flex-shrink-0">
                <div
                  className={`flex flex-col items-center p-2 rounded-md transition-all duration-200 ease-in-out ${statusClasses} ${status !== 'pending' ? 'bg-white shadow-sm' : 'bg-gray-100'}`}
                  title={step.key}
                >
                  <span className={`w-3 h-3 rounded-full mb-1 ${dotClasses}`}></span>
                  <span className={`text-xs text-center ${textClasses}`}>{step.label}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
};
