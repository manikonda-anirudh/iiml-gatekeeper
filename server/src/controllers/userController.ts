import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';

interface ProfileData {
  mobile_number?: string;
  hostel_number?: string;
  emergency_contact?: string;
  personal_email?: string;
  gender?: string;
  // Note: department is a direct column in users table, not in profile_data
}

// Map Supabase user to app User type
const mapSupabaseUserToAppUser = (dbUser: any) => {
  const profileData: ProfileData = dbUser.profile_data || {};
  
  // Normalize role to uppercase to match frontend UserRole enum
  const normalizedRole = dbUser.role 
    ? (typeof dbUser.role === 'string' ? dbUser.role.toUpperCase() : dbUser.role)
    : 'STUDENT';
  
  return {
    id: dbUser.id,
    studentId: dbUser.student_id || undefined,
    name: dbUser.full_name || '',
    firstName: dbUser.full_name?.split(' ')[0] || undefined,
    lastName: dbUser.full_name?.split(' ').slice(1).join(' ') || undefined,
    role: normalizedRole,
    instituteEmail: dbUser.institute_mail || undefined,
    personalEmail: profileData.personal_email || undefined,
    mobileNumber: profileData.mobile_number || undefined,
    hostelRoomNo: profileData.hostel_number || undefined,
    emergencyContact: profileData.emergency_contact || undefined,
    gender: profileData.gender || undefined,
    department: dbUser.department || undefined, // department is a direct column, not in profile_data
    profileData: profileData
  };
};

// Helper function to create user in public.users from auth.users using database function
const createUserFromAuth = async (authUserId: string, email: string) => {
  try {
    // Extract name from email (fallback)
    const emailParts = email.split('@')[0].split('.');
    const fullName = emailParts.map(part => 
      part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    ).join(' ');

    // Determine role based on email domain or default to STUDENT
    let role = 'STUDENT';
    if (email.includes('@staff.iiml.ac.in') || email.includes('@admin.iiml.ac.in')) {
      role = 'GATE_STAFF';
    } else if (email.includes('@council.iiml.ac.in')) {
      role = 'COUNCIL';
    }

    // Try to call database function to sync from auth.users
    // If function doesn't exist, create user directly
    const { data: rpcData, error: rpcError } = await supabase.rpc('sync_user_from_auth', {
      user_id: authUserId,
      user_email: email
    });

    // If RPC function doesn't exist or fails, create user directly
    if (rpcError) {
      console.log('RPC function not available, creating user directly...');
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: authUserId,
          full_name: fullName,
          institute_mail: email,
          role: role,
          profile_data: {}
        })
        .select()
        .single();

      if (createError) {
        // If user already exists, try to fetch it
        if (createError.code === '23505') { // Unique violation
          const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUserId)
            .single();
          return existingUser;
        }
        console.error('Error creating user in public.users:', createError);
        return null;
      }

      return newUser;
    }

    // If RPC succeeded, fetch the created user
    const { data: newUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUserId)
      .single();

    return newUser;
  } catch (error) {
    console.error('Error in createUserFromAuth:', error);
    return null;
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    let { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    // If user doesn't exist in public.users, try to create from auth.users
    if (error || !data) {
      console.log('User not found in public.users, attempting to create from auth.users...');
      
      // Try to get email from a database function or use a placeholder
      // Since we don't have direct access to auth.users, we'll need the email passed
      // For now, we'll try to create with a generic approach
      // The trigger should handle this, but if it doesn't exist, we create manually
      
      // Try calling sync function
      const { error: syncError } = await supabase.rpc('sync_existing_users');
      
      // After sync attempt, try fetching again
      const { data: syncedData, error: syncFetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      
      if (!syncFetchError && syncedData) {
        data = syncedData;
        error = null;
      }
    }

    if (error || !data) {
      console.error('Error fetching user:', error);
      return res.status(404).json({ error: 'User not found', details: error?.message || 'User does not exist' });
    }

    const user = mapSupabaseUserToAppUser(data);
    res.json(user);
  } catch (error: any) {
    console.error('Error in getUserById:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

export const getUserByEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const decodedEmail = decodeURIComponent(email);
    
    console.log(`Fetching user by email: ${decodedEmail}`);
    
    let { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('institute_mail', decodedEmail)
      .single();

    // If user doesn't exist in public.users, try to sync from auth.users
    if (error || !data) {
      console.log('User not found in public.users, attempting to sync from auth.users...');
      
      // Try to sync all existing users first (this will sync the user if they exist in auth.users)
      const { error: syncError } = await supabase.rpc('sync_existing_users');
      
      if (syncError) {
        console.warn('sync_existing_users function not available or failed:', syncError.message);
      }
      
      // Try fetching again after sync
      const { data: syncedData, error: syncFetchError } = await supabase
        .from('users')
        .select('*')
        .eq('institute_mail', decodedEmail)
        .single();
      
      if (!syncFetchError && syncedData) {
        data = syncedData;
        error = null;
        console.log('User found after sync');
      } else {
        // If still not found, the user might not exist in auth.users yet
        // This can happen if they just signed up and trigger hasn't run yet
        console.log('User not found after sync. They may not exist in auth.users yet or trigger hasn\'t run.');
      }
    }

    if (error || !data) {
      console.error('Error fetching user by email:', error);
      return res.status(404).json({ 
        error: 'User not found', 
        details: error?.message || 'User does not exist in public.users. They may need to sign up first.' 
      });
    }

    const user = mapSupabaseUserToAppUser(data);
    console.log(`Successfully fetched user: ${user.name} (${user.id})`);
    res.json(user);
  } catch (error: any) {
    console.error('Error in getUserByEmail:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { mobileNumber, hostelRoomNo, emergencyContact } = req.body;

    // First, get the current user data
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('profile_data')
      .eq('id', id)
      .single();

    if (fetchError || !currentUser) {
      return res.status(404).json({ error: 'User not found', details: fetchError?.message });
    }

    // Merge with existing profile_data
    const existingProfileData: ProfileData = currentUser.profile_data || {};
    const updatedProfileData: ProfileData = {
      ...existingProfileData,
      ...(mobileNumber !== undefined && { mobile_number: mobileNumber }),
      ...(hostelRoomNo !== undefined && { hostel_number: hostelRoomNo }),
      ...(emergencyContact !== undefined && { emergency_contact: emergencyContact }),
    };

    // Update the user's profile_data
    const { data, error } = await supabase
      .from('users')
      .update({ profile_data: updatedProfileData })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return res.status(400).json({ error: 'Failed to update profile', details: error.message });
    }

    const user = mapSupabaseUserToAppUser(data);
    res.json(user);
  } catch (error: any) {
    console.error('Error in updateUserProfile:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
