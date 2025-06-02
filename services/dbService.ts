

// services/dbService.ts
import { supabase } from './supabaseClient';

export interface Profile {
  id: string; // User UUID from auth.users
  role: 'creator' | 'brand';
  email?: string | null;
  full_name?: string | null;
  updated_at?: string | null;
}
export interface Campaign {
  id: string;
  user_id: string; // Should be profile.id of a 'brand'
  name: string;
  description: string;
  created_at: string;
  budget?: number | null;
  goals?: string | null;
  status?: string | null; 
  matched_influencers_data?: MatchedInfluencer[] | null; 
  current_workflow_step?: string | null; 
  campaign_tag?: string | null; // Remains a string, parsing will happen client-side for now
}

export interface MatchedInfluencer {
  id: string; 
  name: string;
  niche: string; // Primary niche for display, matching will use content_tags
}

export interface Influencer {
  id: string; 
  user_id: string; 
  name: string; 
  niche: string; // Primary niche/category
  platform?: string | null;
  followers?: number | null;
  engagement_rate?: number | null;
  contact_email?: string | null; 
  social_handles?: Record<string, string> | null; 
  content_tags?: string[] | null; // Array of tags for matching
  created_at: string;
}

export interface Response { 
  id: string;
  campaign_id: string;
  message: string;
  created_at: string;
}

export interface WorkflowLog {
  id: string;
  campaign_id: string;
  step_name: string;
  details?: object | null;
  status?: string | null;
  created_at: string;
}

export type CampaignEnrollmentStatus = 
  | 'pending_creator_approval' 
  | 'approved_by_creator' 
  | 'rejected_by_creator' 
  | 'brand_cancelled_offer' 
  | 'in_progress' 
  | 'work_submitted' 
  | 'work_approved_by_brand' 
  | 'payment_pending' 
  | 'payment_processed' 
  | 'completed' 
  | 'disputed'
  | 'contract_drafting_by_brand' 
  | 'contract_pending_brand_send' 
  | 'contract_sent_to_creator'    
  | 'contract_approved_by_creator' 
  | 'contract_rejected_by_creator';


export interface CampaignEnrollment {
  id: string;
  campaign_id: string;
  influencer_user_id: string; // Creator's profile ID (which is auth.users.id)
  status: CampaignEnrollmentStatus;
  offer_details?: Record<string, any> | null; // Made it Record<string,any> for flexibility
  creator_notes?: string | null;
  enrolled_at?: string | null; 
  created_at: string;
  updated_at?: string | null;
  deliverables?: string | null;
  terms_and_conditions?: string | null;
  contract_draft_v1?: string | null; 
  contract_final_version?: string | null; 
}

export type CampaignEnrollmentWithCampaignDetails = CampaignEnrollment & {
  campaigns: { 
    name: string;
    description: string;
    campaign_tag?: string | null;
  } | null; 
};

// Updated structure for fetching influencer details via profiles
export type CampaignEnrollmentWithInfluencerProfile = CampaignEnrollment & {
  profile_data: { // This corresponds to the 'profiles' table
    id: string; // profiles.id
    full_name: string | null; // profiles.full_name
    role: 'creator' | 'brand' | null; // profiles.role
    influencer_profile: { // This corresponds to the 'influencers' table
      id: string; // influencers.id (PK of influencers table)
      name: string; // influencers.name (THE NAME WE WANT)
      niche: string; // influencers.niche
    } | null; 
  } | null; 
};


// --- Profile Management ---
export async function getUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { 
    console.error('Original Supabase Error during getUserProfile:', error);
    throw new Error(error.message || 'An unknown error occurred while fetching user profile.');
  }
  return data as Profile | null;
}

export async function getCreatorProfile(userId: string): Promise<Influencer | null> {
  const { data, error } = await supabase
    .from('influencers')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Original Supabase Error during getCreatorProfile:', error);
    throw new Error(error.message || 'An unknown error occurred while fetching creator profile.');
  }
  return data as Influencer | null;
}

export async function createOrUpdateCreatorProfile(userId: string, profileData: Partial<Omit<Influencer, 'id' | 'created_at' | 'user_id'>>): Promise<Influencer> {
  const { data: existingProfile, error: fetchError } = await supabase
    .from('influencers')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') { 
    console.error('Error checking for existing creator profile:', fetchError);
    throw new Error(fetchError.message || "Could not verify existing creator profile.");
  }

  let resultData: Influencer | null = null; 
  let operationError: any = null;

  // Normalize content_tags: ensure they are lowercase and unique if they exist
  if (profileData.content_tags && Array.isArray(profileData.content_tags)) {
    profileData.content_tags = [...new Set(profileData.content_tags.map(tag => String(tag || '').toLowerCase().trim()).filter(tag => tag !== ''))];
  }


  if (existingProfile && existingProfile.id) {
    const { data: updateData, error: updateError } = await supabase
      .from('influencers')
      .update({ ...profileData }) 
      .eq('user_id', userId)
      .select()
      .single(); 
    resultData = updateData;
    operationError = updateError;
  } else {
    const { data: insertData, error: insertError } = await supabase
      .from('influencers')
      .insert([{ ...profileData, user_id: userId }]) 
      .select()
      .single(); 
    resultData = insertData;
    operationError = insertError;
  }
  
  if (operationError) {
    console.error('Original Supabase Error during createOrUpdateCreatorProfile:', operationError);
    throw new Error(operationError.message || 'An unknown error occurred while saving creator profile.');
  }
  if (!resultData) { 
    throw new Error('Creator profile operation did not return data.');
  }
  return resultData as Influencer; 
}


// --- Campaign Management ---
export async function createCampaign(
  brandUserId: string, 
  name: string,
  description: string,
  budget?: number,
  goals?: string,
  campaignTag?: string // Stays as a string, client will parse for matching
): Promise<Campaign[]> { 
  const insertData = { 
      user_id: brandUserId, 
      name, 
      description, 
      budget: budget || null, 
      goals: goals || null,
      campaign_tag: campaignTag || null, // campaign_tag stored as provided string
      status: 'New', 
      current_workflow_step: 'Campaign Created', 
      matched_influencers_data: [] 
    };

  console.log('[dbService.createCampaign] Attempting to insert campaign:', insertData);
  const { data, error } = await supabase
    .from('campaigns')
    .insert([insertData]) 
    .select();

  if (error) {
    console.error('Original Supabase Error during createCampaign:', error);
     if (error.code === '23503' && error.message.includes('campaigns_user_id_fkey')) {
        throw new Error(
            `Failed to create campaign: The brand user ID (${brandUserId}) does not exist in the 'profiles' table. ` +
            "This usually means the 'handle_new_user' trigger failed to create a profile upon signup, " +
            "or the 'campaigns.user_id' foreign key is misconfigured (it should point to 'profiles.id'). " +
            `Original error: ${error.message}`
        );
    }
    throw new Error(error.message || 'An unknown error occurred while creating the campaign.');
  }
  console.log('[dbService.createCampaign] Campaign creation successful, data:', data);
  if (data && data.length > 0 && data[0]) { 
    const logDetails = { name: insertData.name, budget: insertData.budget, goals: insertData.goals, campaign_tag: insertData.campaign_tag };
    try {
        await logWorkflowStep(data[0].id, 'Campaign Created', logDetails, 'success');
    } catch (logError) {
        console.warn("Failed to log campaign creation step, but campaign was created:", logError);
    }
  } else {
    console.warn('createCampaign insert operation succeeded but returned no data.');
    return [];
  }
  return data as Campaign[];
}


export async function getCampaigns(brandUserId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('user_id', brandUserId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Original Supabase Error during getCampaigns:', error);
    throw new Error(error.message || 'An unknown error occurred while fetching campaigns.');
  }
  return data as Campaign[] || []; 
}

export async function deleteCampaign(campaignId: string, brandUserId: string): Promise<void> {
    const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId)
        .eq('user_id', brandUserId); 

    if (error) {
        console.error('Original Supabase Error during deleteCampaign:', error);
        throw new Error(error.message || 'An unknown error occurred while deleting the campaign.');
    }
}


export async function updateCampaign(campaignId: string, updates: Partial<Campaign>): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', campaignId)
    .select();

  if (error) {
    console.error('Original Supabase Error during updateCampaign:', error);
    throw new Error(error.message || 'An unknown error occurred while updating the campaign.');
  }
  return data as Campaign[] || [];
}

// --- Influencer Discovery for Brands ---
export async function getInfluencersByTagsArray(tags: string[]): Promise<Influencer[]> {
  console.log('[dbService.getInfluencersByTagsArray] Received tags for query:', tags);
  const normalizedQueryTags = (tags || [])
    .map(tag => String(tag || '').toLowerCase().trim())
    .filter(tag => tag !== '');

  console.log('[dbService.getInfluencersByTagsArray] Normalized query tags for Supabase:', normalizedQueryTags);

  if (normalizedQueryTags.length === 0) {
    console.log('[dbService.getInfluencersByTagsArray] No valid query tags after normalization, returning empty array.');
    return [];
  }

  const { data, error } = await supabase
    .from('influencers') 
    .select('*')
    .overlaps('content_tags', normalizedQueryTags);

  // CRITICAL LOG: Shows what Supabase returns directly
  console.log('[dbService.getInfluencersByTagsArray] Supabase RAW response - data:', JSON.stringify(data), 'error:', JSON.stringify(error));

  if (error) {
    console.error('Original Supabase Error during getInfluencersByTagsArray:', error);
    throw new Error(error.message || 'An unknown error occurred while fetching influencers by tags array.');
  }
  
  console.log(`[dbService.getInfluencersByTagsArray] Found ${data ? data.length : 0} influencers matching tags:`, normalizedQueryTags);
  return data as Influencer[] || [];
}


export async function getAllInfluencers(): Promise<Influencer[]> {
  const { data, error } = await supabase
    .from('influencers')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Original Supabase Error during getAllInfluencers:', error);
    throw new Error(error.message || 'An unknown error occurred while fetching all influencers.');
  }
  return data as Influencer[] || [];
}

// --- Campaign Enrollment Management ---
export async function createCampaignEnrollment(
  campaignId: string,
  influencerUserId: string, 
  brandUserId: string, 
  offerDetails?: object
): Promise<CampaignEnrollment> {
  console.log('[dbService.createCampaignEnrollment] Attempting to create enrollment with:', { campaignId, influencerUserId, brandUserId, offerDetails });
  const { data, error } = await supabase
    .from('campaign_enrollments')
    .insert([{
      campaign_id: campaignId,
      influencer_user_id: influencerUserId,
      status: 'pending_creator_approval',
      offer_details: offerDetails || null,
    }])
    .select()
    .single();

  if (error) {
    console.error('Original Supabase Error during createCampaignEnrollment:', error);
    if (error.code === '23505') { 
        throw new Error('This creator has already been offered a spot or is enrolled in this campaign.');
    }
    throw new Error(error.message || 'Failed to create campaign enrollment offer.');
  }
  if (!data) throw new Error('Campaign enrollment offer created but no data returned.');
  console.log('[dbService.createCampaignEnrollment] Enrollment created successfully:', data);
  return data as CampaignEnrollment;
}

export async function getEnrollmentsForCreator(creatorUserId: string): Promise<CampaignEnrollmentWithCampaignDetails[]> {
  console.log('[dbService.getEnrollmentsForCreator] Fetching enrollments for creatorUserId:', creatorUserId);
  const { data, error } = await supabase
    .from('campaign_enrollments')
    .select(`
      *,
      campaigns (
        name,
        description,
        campaign_tag
      )
    `)
    .eq('influencer_user_id', creatorUserId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Original Supabase Error during getEnrollmentsForCreator:', error);
    if (error.message.includes("relation \"public.campaign_enrollments\" does not exist")) {
        throw new Error("Database Error: The 'campaign_enrollments' table does not exist. Please ensure database schema is up to date.");
    }
    if (error.message.includes("Could not find a relationship between 'campaign_enrollments' and 'campaigns'")) {
        throw new Error("Database Error: Relationship between 'campaign_enrollments' and 'campaigns' is missing or misconfigured. Check foreign keys.");
    }
    throw new Error(error.message || 'Failed to fetch creator enrollments.');
  }
  console.log('[dbService.getEnrollmentsForCreator] Fetched enrollments:', data);
  return data as CampaignEnrollmentWithCampaignDetails[] || [];
}

export async function getEnrollmentsForCampaign(campaignId: string): Promise<CampaignEnrollmentWithInfluencerProfile[]> {
  console.log('[dbService.getEnrollmentsForCampaign] Fetching enrollments for campaignId:', campaignId);
  
  const selectQueryWithJoin = `
    *,
    profile_data:influencer_user_id!profiles ( 
      id,
      full_name,
      role,
      influencer_profile:influencers!user_id (
        id,
        name,
        niche
      )
    )
  `;
  const selectQueryWithoutJoin = '*';

  let response = await supabase
    .from('campaign_enrollments')
    .select(selectQueryWithJoin)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (response.error) {
    console.error(
      'Original Supabase Error during getEnrollmentsForCampaign (with join). Raw error object logged below. Key properties:' +
      `\n  Message: ${response.error.message || 'N/A'}` +
      `\n  Code: ${response.error.code || 'N/A'}` +
      `\n  Details: ${response.error.details || 'N/A'}` +
      `\n  Hint: ${response.error.hint || 'N/A'}`
    );
    console.error('Raw error object for inspection:', response.error);

    const errorMessage = response.error.message ? response.error.message.toLowerCase() : "";
    
    if (errorMessage.includes("could not find a relationship") && 
        errorMessage.includes("campaign_enrollments") && 
        (errorMessage.includes("influencer_user_id") || errorMessage.includes("profiles"))) {
      
      console.warn(
        `[dbService.getEnrollmentsForCampaign] CRITICAL DB SCHEMA ISSUE: Failed to join 'profiles' and 'influencers' data due to missing/misconfigured Foreign Key constraints. ` +
        `The error was: "${response.error.message || 'N/A'}". ` +
        "This usually means 'campaign_enrollments.influencer_user_id' is not correctly linked to 'profiles.id', or 'influencers.user_id' to 'profiles.id'. " +
        "FALLING BACK to fetching enrollments without profile details. Influencer names and details might be missing in the UI. " +
        "ACTION REQUIRED: Please verify your database schema in Supabase SQL Editor as per previous detailed error logs."
      );

      response = await supabase
        .from('campaign_enrollments')
        .select(selectQueryWithoutJoin)
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (response.error) {
        console.error('Original Supabase Error during getEnrollmentsForCampaign (fallback query):', response.error);
        throw new Error(`Fallback query also failed: ${response.error.message || 'Failed to fetch enrollments for campaign.'}`);
      }
      
      const enrollmentsWithoutProfileData = response.data?.map(enrollment => ({
        ...enrollment,
        profile_data: null, 
      })) as CampaignEnrollmentWithInfluencerProfile[] || [];
      
      console.log('[dbService.getEnrollmentsForCampaign] Fetched enrollments using FALLBACK (no profile join):', JSON.stringify(enrollmentsWithoutProfileData, null, 2));
      return enrollmentsWithoutProfileData;

    } else {
      const baseMessage = `Failed to fetch enrollments for campaign (ID: ${campaignId}). Supabase Error: ${response.error.message || 'N/A'}.`;
      let detailedMessage = `CRITICAL DATABASE SCHEMA ERROR: ${baseMessage} Supabase could not resolve the requested relationships. ` +
                        "This means your database tables ('campaign_enrollments', 'profiles', 'influencers') are likely MISSING critical FOREIGN KEY constraints or UNIQUE constraints that define how they link together. " +
                        "The query uses explicit hints (e.g., '!profiles', '!user_id'), so if it still fails, the DB schema is the problem. " +
                        "ACTION REQUIRED: You MUST verify the following in your Supabase SQL Editor: " +
                        "1. A Foreign Key constraint EXISTS from 'campaign_enrollments.influencer_user_id' to 'profiles.id'. This is the MOST LIKELY cause of this specific error. " +
                        "2. A Foreign Key constraint EXISTS from 'influencers.user_id' to 'profiles.id'. " +
                        "3. The 'influencers.user_id' column MUST have a UNIQUE constraint. " +
                        "4. Ensure all tables ('campaign_enrollments', 'profiles', 'influencers') and their columns ('id', 'influencer_user_id', 'user_id', 'name', 'full_name', etc.) exist and are correctly named. " +
                        "Frontend code CANNOT fix this. Please correct your database schema. Hint from Supabase: " + (response.error.hint || 'N/A');
      console.error("[dbService.getEnrollmentsForCampaign] Detailed error context (non-fallback):", detailedMessage);
      throw new Error(detailedMessage);
    }
  }

  const data = response.data;
  if (data && data.length > 0) {
    const missingProfileData = data.some(e => !e.profile_data);
    const missingInfluencerProfile = data.some(e => e.profile_data && !e.profile_data.influencer_profile);

    if (missingProfileData || missingInfluencerProfile) {
      const problem = missingProfileData ? "'profile_data' is null" : "'influencer_profile' is null within 'profile_data'";
      const errorMessage = `Data inconsistency in getEnrollmentsForCampaign (ID: ${campaignId}): ${problem} for one or more enrollments. ` +
                           "This strongly suggests an issue with Foreign Key relationships or UNIQUE constraints in your Supabase schema, even if the main join succeeded. " +
                           "Please verify: " +
                           "1. FK: 'campaign_enrollments.influencer_user_id' -> 'profiles.id'. " +
                           "2. FK: 'influencers.user_id' -> 'profiles.id'. " +
                           "3. UNIQUE constraint on 'influencers.user_id'. " +
                           "4. Ensure 'influencers' table has 'id', 'name', 'niche' and 'profiles' has 'id', 'full_name', 'role'. " +
                           "The name for the Contracting Module will be incorrect until this is resolved.";
      console.error(errorMessage);
    }
  }

  console.log('[dbService.getEnrollmentsForCampaign] Fetched enrollments for campaign (with join attempt):', JSON.stringify(data, null, 2));
  return data as CampaignEnrollmentWithInfluencerProfile[] || [];
}


export async function updateCreatorEnrollmentStatus(
  enrollmentId: string,
  newStatus: Extract<CampaignEnrollmentStatus, 'approved_by_creator' | 'rejected_by_creator'>,
  creatorUserId: string, 
  notes?: string
): Promise<CampaignEnrollment> {
  const updateData: Partial<CampaignEnrollment> = { status: newStatus };
  if (newStatus === 'approved_by_creator') {
    updateData.enrolled_at = new Date().toISOString();
  }
  if (notes) {
    updateData.creator_notes = notes;
  }
  console.log('[dbService.updateCreatorEnrollmentStatus] Updating enrollment:', { enrollmentId, newStatus, creatorUserId, notes });
  const { data, error } = await supabase
    .from('campaign_enrollments')
    .update(updateData)
    .eq('id', enrollmentId)
    .eq('influencer_user_id', creatorUserId) 
    .select()
    .single();

  if (error) {
    console.error('Original Supabase Error during updateCreatorEnrollmentStatus:', error);
    throw new Error(error.message || 'Failed to update enrollment status.');
  }
  if (!data) throw new Error('Enrollment status updated but no data returned.');
  console.log('[dbService.updateCreatorEnrollmentStatus] Enrollment updated successfully:', data);
  return data as CampaignEnrollment;
}

export async function updateCampaignEnrollmentDetails(
  enrollmentId: string,
  updates: Partial<Pick<CampaignEnrollment, 'deliverables' | 'terms_and_conditions' | 'contract_draft_v1' | 'contract_final_version' | 'status'>>,
  brandUserId: string // This parameter is for logical context client-side; RLS uses auth.uid()
): Promise<CampaignEnrollment> {
  console.log('[dbService.updateCampaignEnrollmentDetails] Updating enrollment:', { enrollmentId, updates, brandUserId_context: brandUserId });
  
  const { data, error, count } = await supabase
    .from('campaign_enrollments')
    .update(updates)
    .eq('id', enrollmentId)
    .select()
    .single(); 
  
  if (error) {
    console.error('Supabase Error during updateCampaignEnrollmentDetails:');
    console.error('Message:', error.message);
    console.error('Details:', error.details);
    console.error('Hint:', error.hint);
    console.error('Code:', error.code);

    let userFriendlyMessage = `Failed to update enrollment (ID: ${enrollmentId}). Supabase code: ${error.code}. Message: ${error.message}.`;
    
    if (error.code === 'PGRST116' || (count !== null && count === 0 && !error.message.includes('violates row-level security policy'))) {
        userFriendlyMessage += " This often means the record was not found, or Row Level Security (RLS) policies prevented access or modification, or no actual changes were made by the update (data was identical).";
    } else if (error.message.toLowerCase().includes('rls') || 
               error.message.toLowerCase().includes('row level security') || 
               error.message.toLowerCase().includes('row-level security policy') ||
               error.code === '42501' /* PostgreSQL permission denied */) {
        userFriendlyMessage += " This is LIKELY due to Row Level Security (RLS) policies. Please ensure your 'campaign_enrollments' table permissions in Supabase allow the current user (brand) to perform this UPDATE operation. The policy usually checks if the brand owns the parent campaign.";
    } else if (error.code === '23503') { // Foreign key violation
        userFriendlyMessage += " This could be a foreign key violation. Ensure all referenced IDs (like campaign_id) are valid.";
    }
    console.error("[dbService.updateCampaignEnrollmentDetails] User-friendly error to throw:", userFriendlyMessage);
    throw new Error(userFriendlyMessage);
  }

  if (!data) {
    console.warn('[dbService.updateCampaignEnrollmentDetails] Update operation returned no error, but also no data. Enrollment ID:', enrollmentId, "Count:", count);
    throw new Error('Enrollment details update seemed to succeed (no Supabase error) but no data was returned from the SELECT. This might indicate the record was not found or an RLS issue prevented seeing the updated record after the update.');
  }

  console.log('[dbService.updateCampaignEnrollmentDetails] Enrollment details updated successfully:', data, "Rows affected by update (if available):", count);
  return data as CampaignEnrollment;
}

export async function getAvailableCampaignsForCreator(creatorUserId: string): Promise<Campaign[]> {
  console.log('[dbService.getAvailableCampaignsForCreator] Fetching available campaigns for creatorUserId:', creatorUserId);
  const recruitingStatuses = ['New', 'Matching Complete', 'Creator Offers Sent', 'Initial Outreach Complete']; 
  
  const { data: allPotentiallyAvailableCampaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('*')
    .in('status', recruitingStatuses) 
    .order('created_at', { ascending: false });

  if (campaignsError) {
    console.error('Error fetching potentially available campaigns:', campaignsError);
    throw new Error(campaignsError.message || 'Failed to fetch potentially available campaigns.');
  }
  if (!allPotentiallyAvailableCampaigns) {
    console.log('[dbService.getAvailableCampaignsForCreator] No potentially available campaigns found.');
    return [];
  }
  console.log('[dbService.getAvailableCampaignsForCreator] All potentially available campaigns:', allPotentiallyAvailableCampaigns);

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('campaign_enrollments')
    .select('campaign_id')
    .eq('influencer_user_id', creatorUserId);

  if (enrollmentsError) {
    console.error('Error fetching creator existing enrollments:', enrollmentsError);
     if (enrollmentsError.message.includes("relation \"public.campaign_enrollments\" does not exist")) {
        throw new Error("Database Error: The 'campaign_enrollments' table does not exist for filtering. Please ensure database schema is up to date.");
    }
    throw new Error(enrollmentsError.message || 'Failed to fetch creator involvement data for filtering.');
  }
  console.log('[dbService.getAvailableCampaignsForCreator] Creator existing enrollments (for filtering):', enrollments);

  const enrolledCampaignIds = new Set(enrollments?.map(e => e.campaign_id) || []);
  console.log('[dbService.getAvailableCampaignsForCreator] Enrolled campaign IDs for filtering:', enrolledCampaignIds);

  const availableCampaigns = allPotentiallyAvailableCampaigns.filter(
    campaign => !enrolledCampaignIds.has(campaign.id)
  );
  console.log('[dbService.getAvailableCampaignsForCreator] Final list of available campaigns:', availableCampaigns);
  
  return availableCampaigns as Campaign[] || [];
}


// --- Workflow Logging & AI Responses ---
export async function logWorkflowStep(
  campaignId: string,
  stepName: string,
  details?: object,
  status: string = 'info'
): Promise<WorkflowLog[]> {
  const { data, error } = await supabase
    .from('workflow_logs')
    .insert([{ campaign_id: campaignId, step_name: stepName, details, status }])
    .select();
  
  if (error) {
    console.error('Original Supabase Error during logWorkflowStep:', error);
    console.warn(`Failed to log workflow step "${stepName}" for campaign ${campaignId}. Error: ${error.message}. The operation continued.`);
    // Return empty or throw depending on how critical logging is. For now, allow continuation.
    return []; 
  }
  return data as WorkflowLog[] || [];
}

export async function getWorkflowLogs(campaignId: string): Promise<WorkflowLog[]> {
  const { data, error } = await supabase
    .from('workflow_logs')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Original Supabase Error during getWorkflowLogs:', error);
    throw new Error(error.message || 'An unknown error occurred while fetching workflow logs.');
  }
  return data as WorkflowLog[] || [];
}

export async function addResponse(campaignId: string, message: string): Promise<Response[]> {
  const { data, error } = await supabase
    .from('responses') 
    .insert([{ campaign_id: campaignId, message }])
    .select();

  if (error) {
    console.error('Original Supabase Error during addResponse:', error);
    throw new Error(error.message || 'An unknown error occurred while adding the response.');
  }
  return data as Response[] || [];
}

export async function getResponses(campaignId: string): Promise<Response[]> {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Original Supabase Error during getResponses:', error);
    throw new Error(error.message || 'An unknown error occurred while fetching responses.');
  }
  return data as Response[] || [];
}
