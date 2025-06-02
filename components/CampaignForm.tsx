
// components/CampaignForm.tsx
import React, { useState } from 'react';
import { createCampaign } from '../services/dbService';

interface CampaignFormProps {
  currentUserId: string; 
  onCampaignCreated: () => void;
  onCancel: () => void;
}

const CampaignForm: React.FC<CampaignFormProps> = ({ currentUserId, onCampaignCreated, onCancel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [goals, setGoals] = useState('');
  const [campaignTag, setCampaignTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createCampaign(currentUserId, name, description, parseFloat(budget) || undefined, goals, campaignTag);
      onCampaignCreated();
    } catch (err) {
      console.error('Failed to create campaign:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-700 mb-6">Create New Campaign</h2>
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">Campaign Name</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-white"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-white"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="budget" className="block text-gray-700 text-sm font-bold mb-2">Budget (Optional)</label>
          <input
            type="number"
            id="budget"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-white"
            placeholder="e.g., 5000"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="goals" className="block text-gray-700 text-sm font-bold mb-2">Campaign Goals (Optional)</label>
          <textarea
            id="goals"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            rows={3}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-white"
            placeholder="e.g., Increase brand awareness, drive product sales"
          />
        </div>
        <div className="mb-6">
          <label htmlFor="campaignTag" className="block text-gray-700 text-sm font-bold mb-2">Campaign Tags/Categories (Optional)</label>
          <input
            type="text"
            id="campaignTag"
            value={campaignTag}
            onChange={(e) => setCampaignTag(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-white"
            placeholder="e.g., Lifestyle, Tech, Gaming, Food (comma-separated)"
          />
           <p className="text-xs text-gray-500 mt-1">Enter multiple tags separated by commas. Creators will be matched if they have any of these tags.</p>
        </div>
        <div className="flex items-center justify-between">
          <button 
            type="submit" 
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            {loading ? 'Creating...' : 'Create Campaign'}
          </button>
          <button 
            type="button" 
            onClick={onCancel}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default CampaignForm;
