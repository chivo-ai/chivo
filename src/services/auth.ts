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
  username?: string;
  country: string;
  city: string;
  logoUrl: string;
  bannerUrl: string;
  stickerKey: string;
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

export async function sendPasswordReset(email: string) {
  const cleanEmail = email.trim();

  if (!cleanEmail) {
    throw new Error('Email is required.');
  }

  const { error } = await client().auth.resetPasswordForEmail(cleanEmail);

  if (error) {
    throw error;
  }
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
      username: input.username?.trim(),
      country: input.country.trim(),
      city: input.city.trim(),
      logoUrl: input.logoUrl.trim(),
      bannerUrl: input.bannerUrl.trim(),
      stickerKey: input.stickerKey.trim(),
    },
  });

  if (error) {
    await throwFunctionError(error, 'Could not create school.');
  }

  return data;
}

export async function acceptInvite(code: string) {
  const { data, error } = await client().functions.invoke('accept-invite', {
    body: { code: code.trim().toUpperCase() },
  });

  if (error) {
    await throwFunctionError(error, 'Could not use that code.');
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
    await throwFunctionError(error, 'Could not send request.');
  }

  return data;
}

async function throwFunctionError(error: unknown, fallback: string): Promise<never> {
  const context = (error as { context?: { json?: () => Promise<unknown>; text?: () => Promise<string> } }).context;

  if (context?.json) {
    try {
      const body = await context.json();
      if (body && typeof body === 'object' && 'error' in body) {
        const message = String((body as { error?: unknown }).error ?? '').trim();
        if (message) {
          throw new Error(message);
        }
      }
    } catch (caught) {
      if (caught instanceof Error && caught.message) {
        throw caught;
      }
    }
  }

  if (error instanceof Error && error.message && !error.message.includes('non-2xx')) {
    throw error;
  }

  throw new Error(fallback);
}
