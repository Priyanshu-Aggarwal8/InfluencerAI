import React from 'react';
import { WorkflowLog } from '../services/dbService';

interface WorkflowLogDisplayProps {
  logs: WorkflowLog[];
}

const WorkflowLogDisplay: React.FC<WorkflowLogDisplayProps> = ({ logs }) => {
  if (!logs || logs.length === 0) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg shadow mt-8">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Workflow Log</h3>
        <p className="text-sm text-gray-500">No workflow activities logged yet for this campaign.</p>
      </div>
    );
  }

  return (
    <div className="p-4 border border-gray-200 rounded-lg shadow mt-8">
      <h3 className="text-lg font-semibold text-gray-700 mb-3">Workflow Log</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {logs.map(log => (
          <div key={log.id} className="p-3 bg-gray-50 rounded-md border border-gray-200 text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className={`font-medium text-gray-700 ${log.status === 'failed' ? 'text-red-600' : log.status === 'success' ? 'text-green-600' : 'text-blue-600'}`}>
                {log.step_name}
              </span>
              <span className={`px-2 py-0.5 text-xs rounded-full font-semibold
                                ${log.status === 'failed' ? 'bg-red-100 text-red-700' : 
                                 log.status === 'success' ? 'bg-green-100 text-green-700' : 
                                 'bg-blue-100 text-blue-700'}`}>
                {log.status || 'info'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-1">
              {new Date(log.created_at).toLocaleString()}
            </p>
            {log.details && (
              <pre className="text-xs text-gray-600 bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkflowLogDisplay;