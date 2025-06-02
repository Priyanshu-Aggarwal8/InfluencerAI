
// components/CreatorProfileForm.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { getCreatorProfile, createOrUpdateCreatorProfile, Influencer } from '../services/dbService';

interface CreatorProfileFormProps {
  userId: string;
  userFullName?: string | null; 
}

type SocialPlatforms = 'instagram' | 'youtube' | 'tiktok' | 'twitter' | 'other'; 

const CreatorProfileForm: React.FC<CreatorProfileFormProps> = ({ userId, userFullName }) => {
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [platform, setPlatform] = useState(''); 
  const [followers, setFollowers] = useState<number | ''>('');
  const [engagementRate, setEngagementRate] = useState<number | ''>('');
  const [contactEmail, setContactEmail] = useState('');
  const [socialHandles, setSocialHandles] = useState<Record<string, string>>({
    instagram: '', youtube: '', tiktok: '', twitter: '', other: ''
  });
  const [contentTags, setContentTags] = useState<string[]>([]);
  const [currentTagInput, setCurrentTagInput] = useState(''); 

  const [loadingProfile, setLoadingProfile] = useState(true); 
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    setFormError(null);
    try {
      const existingProfile = await getCreatorProfile(userId);
      if (existingProfile) {
        setName(existingProfile.name || userFullName || '');
        setNiche(existingProfile.niche || '');
        setPlatform(existingProfile.platform || '');
        setFollowers(existingProfile.followers === null || typeof existingProfile.followers === 'undefined' ? '' : existingProfile.followers);
        setEngagementRate(existingProfile.engagement_rate === null || typeof existingProfile.engagement_rate === 'undefined' ? '' : existingProfile.engagement_rate);
        setContactEmail(existingProfile.contact_email || '');
        setSocialHandles(existingProfile.social_handles || { instagram: '', youtube: '', tiktok: '', twitter: '', other: '' });
        setContentTags(existingProfile.content_tags || []);
      } else {
        setName(userFullName || '');
        setSocialHandles({ instagram: '', youtube: '', tiktok: '', twitter: '', other: '' }); 
        setContentTags([]);
      }
    } catch (err) {
      console.error("Failed to fetch creator profile:", err);
      setFormError(err instanceof Error ? err.message : "Could not load your profile data.");
    } finally {
      setLoadingProfile(false);
    }
  }, [userId, userFullName]);

  useEffect(() => {
    if(userId) {
      fetchProfile();
    }
  }, [fetchProfile, userId]);

  const handleAddTag = () => {
    const trimmedTag = currentTagInput.trim().toLowerCase(); // Normalize to lowercase
    if (trimmedTag && !contentTags.includes(trimmedTag)) {
      setContentTags([...contentTags, trimmedTag]);
      setCurrentTagInput('');
    } else if (trimmedTag) {
      // Tag already exists, maybe give feedback or just clear input
      setCurrentTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setContentTags(contentTags.filter(tag => tag !== tagToRemove));
  };

  const handleSocialHandleChange = (platformKey: SocialPlatforms, value: string) => {
    setSocialHandles(prev => ({ ...prev, [platformKey]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    setSuccessMessage(null);

    const cleanedSocialHandles = Object.fromEntries(
      Object.entries(socialHandles).filter(([_, value]) => value && value.trim() !== '')
    );

    // Ensure tags are unique and lowercase before saving
    const normalizedContentTags = [...new Set(contentTags.map(tag => tag.trim().toLowerCase()).filter(tag => tag))];

    const profileData: Partial<Omit<Influencer, 'id' | 'created_at' | 'user_id'>> = {
      name: name.trim() || 'Unnamed Creator', 
      niche: niche.trim() || 'General', 
      platform: platform.trim() || null,
      followers: followers === '' ? null : Number(followers),
      engagement_rate: engagementRate === '' ? null : Number(engagementRate),
      contact_email: contactEmail.trim() || null,
      social_handles: Object.keys(cleanedSocialHandles).length > 0 ? cleanedSocialHandles : null,
      content_tags: normalizedContentTags.length > 0 ? normalizedContentTags : null,
    };
    
    if (!profileData.name) {
        setFormError("Public name is required.");
        setIsSaving(false);
        return;
    }
    if (!profileData.niche) {
        setFormError("Primary Niche/Category is required.");
        setIsSaving(false);
        return;
    }


    try {
      await createOrUpdateCreatorProfile(userId, profileData);
      setSuccessMessage('Profile updated successfully!');
      // Refetch profile to ensure UI reflects the potentially normalized tags from DB
      await fetchProfile(); 
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Failed to save creator profile:", err);
      setFormError(err instanceof Error ? err.message : "An unknown error occurred while saving your profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingProfile) {
    return <div className="p-4 text-center text-gray-600">Loading your creator profile...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 sm:p-8 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Manage Your Creator Profile</h2>
      {formError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">{formError}</div>}
      {successMessage && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 text-sm">{successMessage}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="creatorName" className="block text-sm font-medium text-gray-700">Public Name *</label>
          <input type="text" id="creatorName" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white" />
        </div>
        <div>
          <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700">Contact Email (for collaborations)</label>
          <input type="email" id="contactEmail" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white" />
        </div>
        <div>
          <label htmlFor="niche" className="block text-sm font-medium text-gray-700">Primary Niche/Category *</label>
          <input type="text" id="niche" value={niche} onChange={(e) => setNiche(e.target.value)} required placeholder="e.g., Lifestyle, Tech, Gaming" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white" />
        </div>
        <div>
          <label htmlFor="platform" className="block text-sm font-medium text-gray-700">Primary Platform</label>
          <input type="text" id="platform" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="e.g., Instagram, YouTube, TikTok" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <label htmlFor="followers" className="block text-sm font-medium text-gray-700">Followers</label>
            <input type="number" id="followers" value={followers} onChange={(e) => setFollowers(e.target.value === '' ? '' : parseInt(e.target.value))} min="0" placeholder="e.g., 10000" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white" />
          </div>
          <div>
            <label htmlFor="engagementRate" className="block text-sm font-medium text-gray-700">Engagement Rate (e.g., 0.03 for 3%)</label>
            <input type="number" step="0.001" id="engagementRate" value={engagementRate} onChange={(e) => setEngagementRate(e.target.value === '' ? '' : parseFloat(e.target.value))} min="0" max="1" placeholder="e.g., 0.05" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white" />
          </div>
        </div>

        <fieldset className="border border-gray-300 p-4 rounded-md">
            <legend className="text-sm font-medium text-gray-700 px-1">Social Media Handles</legend>
            {(['instagram', 'youtube', 'tiktok', 'twitter', 'other'] as SocialPlatforms[]).map(key => (
                <div key={key} className="mb-3 last:mb-0">
                    <label htmlFor={`social_${key}`} className="block text-xs font-medium text-gray-600 capitalize">{key}</label>
                    <input 
                        type="text" 
                        id={`social_${key}`} 
                        value={socialHandles[key] || ''} 
                        onChange={(e) => handleSocialHandleChange(key, e.target.value)}
                        placeholder={`${key} username or profile URL`}
                        className="mt-1 block w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                    />
                </div>
            ))}
        </fieldset>

        <div>
          <label className="block text-sm font-medium text-gray-700">Content Tags / Keywords (for matching)</label>
          <div className="flex items-center mt-1">
            <input 
              type="text" 
              value={currentTagInput} 
              onChange={(e) => setCurrentTagInput(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag();}}}
              placeholder="Add a tag (e.g., travel) and press Enter"
              className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
            />
            <button type="button" onClick={handleAddTag} className="px-4 py-2 bg-indigo-500 text-white rounded-r-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1">Add</button>
          </div>
           <p className="text-xs text-gray-500 mt-1">Tags are saved in lowercase. Add tags that describe your content and expertise.</p>
          {contentTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {contentTags.map(tag => (
                <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1.5 flex-shrink-0 text-indigo-400 hover:text-indigo-500 focus:outline-none focus:text-indigo-700">
                    <span className="sr-only">Remove {tag}</span>
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2">
          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
          >
            {isSaving ? 'Saving Profile...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatorProfileForm;
