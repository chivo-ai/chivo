import { supabase } from '../lib/supabase';

type SignUpInput = {
  email: string;
  password: string;
  fullName: string;
  preferredLanguage: string;
  learningLevel: string;
  audioEnabled: boolean;
};

type SignInInput = {
  email: string;
  password: string;
};

type CreateSchoolInput = {
  name: string;
  country: string;
  city: string;
};

type RequestSchoolAccessInput = {
  schoolCode: string;
  requestedRole: string;
  message: string;
};

function client() {
  if (!supabase) {
    throw new Error('Account access is not available right now.');
  }

  return supabase;
}

export async function signUpWithEmail(input: SignUpInput) {
  const { data, error } = await client().auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        preferred_language: input.preferredLanguage.trim() || 'English',
        learning_level: input.learningLevel.trim() || 'balanced',
        audio_enabled: input.audioEnabled,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signInWithEmail(input: SignInInput) {
  const { data, error } = await client().auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  const { error } = await client().auth.signOut();

  if (error) {
    throw error;
  }
}

export async function createSchool(input: CreateSchoolInput) {
  const { data, error } = await client().functions.invoke('create-school', {
    body: {
      name: input.name.trim(),
      country: input.country.trim(),
      city: input.city.trim(),
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function acceptInvite(code: string) {
  const { data, error } = await client().functions.invoke('accept-invite', {
    body: { code: code.trim().toUpperCase() },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function requestSchoolAccess(input: RequestSchoolAccessInput) {
  const { data, error } = await client().functions.invoke('request-school-access', {
    body: {
      schoolCode: input.schoolCode.trim(),
      requestedRole: input.requestedRole,
      message: input.message.trim(),
    },
  });

  if (error) {
    throw error;
  }

  return data;
}
