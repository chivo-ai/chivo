import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GraduationCap, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react-native';

import { hasSupabaseConfig } from '../../lib/config';
import { signInWithEmail, signUpWithEmail } from '../../services/auth';
import { colors } from '../../theme/tokens';

type AuthMode = 'sign_in' | 'sign_up';

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('sign_in');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [learningLevel, setLearningLevel] = useState('balanced');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === 'sign_up';

  async function handleSubmit() {
    setError(null);
    setMessage(null);

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    if (isSignUp && !fullName.trim()) {
      setError('Full name is required to create an account.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const result = await signUpWithEmail({
          email,
          password,
          fullName,
          preferredLanguage,
          learningLevel,
          audioEnabled,
        });

        if (!result.session) {
          setMessage('Account created. Check your email to confirm before signing in.');
        }
      } else {
        await signInWithEmail({ email, password });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', default: undefined })}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.shell}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Sparkles size={24} color="#ffffff" strokeWidth={2.5} />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.brandName}>Chivo AI</Text>
              <Text style={styles.brandMeta}>School accounts, private lessons, personal learning.</Text>
            </View>
          </View>

          <View style={styles.layout}>
            <View style={styles.promisePanel}>
              <View style={styles.promiseIcon}>
                <GraduationCap size={28} color={colors.ink} />
              </View>
              <Text style={styles.promiseTitle}>Start with a real account</Text>
              <Text style={styles.promiseBody}>
                A student, teacher, or school admin signs in first. School access comes next through
                a workspace, invite, class code, or approval.
              </Text>
              <View style={styles.promiseList}>
                <PromiseRow text="Global profile for the person" />
                <PromiseRow text="School membership controls access" />
                <PromiseRow text="Lessons and crews stay permissioned" />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.modeRow}>
                <ModeButton active={mode === 'sign_in'} label="Sign in" onPress={() => setMode('sign_in')} />
                <ModeButton active={mode === 'sign_up'} label="Create account" onPress={() => setMode('sign_up')} />
              </View>

              {!hasSupabaseConfig && (
                <View style={styles.configNotice}>
                  <LockKeyhole size={18} color={colors.coral} />
                  <Text style={styles.configText}>
                    Add Supabase keys in `.env` before accounts can be created.
                  </Text>
                </View>
              )}

              {isSignUp && (
                <Field
                  label="Full name"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your name"
                  autoCapitalize="words"
                />
              )}

              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="name@school.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                secureTextEntry
                autoCapitalize="none"
              />

              {isSignUp && (
                <>
                  <Field
                    label="Preferred language"
                    value={preferredLanguage}
                    onChangeText={setPreferredLanguage}
                    placeholder="English"
                  />
                  <Field
                    label="Learning level"
                    value={learningLevel}
                    onChangeText={setLearningLevel}
                    placeholder="balanced"
                    autoCapitalize="none"
                  />

                  <View style={styles.switchRow}>
                    <View style={styles.flexText}>
                      <Text style={styles.fieldLabel}>Audio lessons</Text>
                      <Text style={styles.helperText}>Allow Chivo AI to prepare listenable study material.</Text>
                    </View>
                    <Switch value={audioEnabled} onValueChange={setAudioEnabled} />
                  </View>
                </>
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}
              {message && <Text style={styles.successText}>{message}</Text>}

              <Pressable
                disabled={!hasSupabaseConfig || loading}
                onPress={handleSubmit}
                style={[styles.submitButton, (!hasSupabaseConfig || loading) && styles.submitButtonDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>{isSignUp ? 'Create account' : 'Sign in'}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'email';
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8b9691"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        style={styles.input}
      />
    </View>
  );
}

function PromiseRow({ text }: { text: string }) {
  return (
    <View style={styles.promiseRow}>
      <ShieldCheck size={18} color={colors.teal} />
      <Text style={styles.promiseRowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.select({ web: 28, default: 58 }),
    paddingBottom: 30,
  },
  shell: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    gap: 26,
  },
  brandRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  brandMeta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  layout: {
    gap: 18,
  },
  promisePanel: {
    borderRadius: 24,
    padding: 22,
    gap: 16,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: '#e2dccd',
  },
  promiseIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  promiseTitle: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  promiseBody: {
    color: '#33413b',
    fontSize: 16,
    lineHeight: 24,
  },
  promiseList: {
    gap: 10,
  },
  promiseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  promiseRowText: {
    flex: 1,
    color: '#33413b',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  card: {
    borderRadius: 22,
    padding: 18,
    gap: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modeRow: {
    minHeight: 48,
    flexDirection: 'row',
    gap: 8,
    padding: 5,
    borderRadius: 17,
    backgroundColor: '#eef2ee',
  },
  modeButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  modeButtonActive: {
    backgroundColor: colors.tealDark,
  },
  modeButtonText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '900',
  },
  modeButtonTextActive: {
    color: '#ffffff',
  },
  configNotice: {
    minHeight: 44,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff0ed',
  },
  configText: {
    flex: 1,
    color: '#8a332a',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  field: {
    gap: 7,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: colors.ink,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 15,
  },
  helperText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  switchRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  successText: {
    color: colors.tealDark,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  submitButton: {
    minHeight: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
});
