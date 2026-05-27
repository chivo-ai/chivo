import { Link } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
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
import {
  ArrowRight,
  Gauge,
  GraduationCap,
  Headphones,
  KeyRound,
  Languages,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
} from 'lucide-react-native';

import { hasSupabaseConfig } from '../../lib/config';
import { signInWithEmail, signUpWithEmail } from '../../services/auth';
import { colors } from '../../theme/tokens';

type AuthMode = 'sign_in' | 'sign_up';

export function AuthScreen({ initialMode = 'sign_in' }: { initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
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

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

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
              <Text style={styles.brandName} numberOfLines={1}>Chivo AI</Text>
              <Text style={styles.brandMeta} numberOfLines={2}>School accounts, private lessons, personal learning.</Text>
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
                <ModeButton
                  active={mode === 'sign_in'}
                  label="Sign in"
                  icon={<LogIn size={16} color={mode === 'sign_in' ? '#ffffff' : colors.brandDeep} />}
                  onPress={() => setMode('sign_in')}
                />
                <ModeButton
                  active={mode === 'sign_up'}
                  label="Create account"
                  icon={<UserPlus size={16} color={mode === 'sign_up' ? '#ffffff' : colors.brandDeep} />}
                  onPress={() => setMode('sign_up')}
                />
              </View>

              {!hasSupabaseConfig && (
                <View style={styles.configNotice}>
                  <LockKeyhole size={18} color={colors.coral} />
                  <Text style={styles.configText}>
                    Account access is not available right now. Please try again later.
                  </Text>
                </View>
              )}

              {isSignUp && (
                <Field
                  label="Full name"
                  icon={<UserRound size={15} color={colors.brandDeep} />}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your name"
                  autoCapitalize="words"
                />
              )}

              <Field
                label="Email"
                icon={<Mail size={15} color={colors.brandDeep} />}
                value={email}
                onChangeText={setEmail}
                placeholder="name@school.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <Field
                label="Password"
                icon={<KeyRound size={15} color={colors.brandDeep} />}
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
                    icon={<Languages size={15} color={colors.brandDeep} />}
                    value={preferredLanguage}
                    onChangeText={setPreferredLanguage}
                    placeholder="English"
                  />
                  <Field
                    label="Learning level"
                    icon={<Gauge size={15} color={colors.brandDeep} />}
                    value={learningLevel}
                    onChangeText={setLearningLevel}
                    placeholder="balanced"
                    autoCapitalize="none"
                  />

                  <View style={styles.switchRow}>
                    <View style={styles.switchIcon}>
                      <Headphones size={16} color={colors.brandDeep} />
                    </View>
                    <View style={styles.flexText}>
                      <Text style={styles.fieldLabel} numberOfLines={1}>Audio lessons</Text>
                      <Text style={styles.helperText} numberOfLines={2}>Allow Chivo AI to prepare listenable study material.</Text>
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
                  <>
                    <Text style={styles.submitButtonText} numberOfLines={1}>{isSignUp ? 'Create account' : 'Sign in'}</Text>
                    <View style={styles.submitButtonIcon}>
                      <ArrowRight size={16} color="#ffffff" />
                    </View>
                  </>
                )}
              </Pressable>
              <View style={styles.linkRow}>
                <Link href="/(auth)/login" asChild>
                  <Pressable>
                    <Text style={styles.linkText}>Login</Text>
                  </Pressable>
                </Link>
                <Link href="/(auth)/register" asChild>
                  <Pressable>
                    <Text style={styles.linkText}>Register</Text>
                  </Pressable>
                </Link>
                <Link href="/(auth)/forgot" asChild>
                  <Pressable>
                    <Text style={styles.linkText}>Forgot</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ModeButton({ active, label, icon, onPress }: { active: boolean; label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <View style={[styles.modeIcon, active && styles.modeIconActive]}>{icon}</View>
      <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  icon?: ReactNode;
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
  icon,
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
      <View style={styles.fieldLabelRow}>
        {icon ? <View style={styles.fieldIcon}>{icon}</View> : null}
        <Text style={styles.fieldLabel} numberOfLines={1}>{label}</Text>
      </View>
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
      <Text style={styles.promiseRowText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.brandDeep,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  linkText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '800',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: Platform.select({ web: 38, default: 58 }),
    paddingBottom: 34,
  },
  shell: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
    gap: 24,
  },
  brandRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.38)',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    color: '#ffffff',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
  },
  brandMeta: {
    color: '#a8b3c7',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
    fontWeight: '700',
  },
  layout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: 16,
  },
  promisePanel: {
    flex: 1,
    minWidth: 280,
    borderRadius: 8,
    padding: 20,
    gap: 16,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 255, 0.22)',
  },
  promiseIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
  },
  promiseTitle: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  promiseBody: {
    color: '#d8e0ef',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  promiseList: {
    gap: 9,
  },
  promiseRow: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  promiseRowText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  card: {
    flex: 1,
    minWidth: 280,
    borderRadius: 8,
    padding: 16,
    gap: 13,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: '#dfe6f0',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
  },
  modeRow: {
    minHeight: 50,
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#eef3fb',
    borderWidth: 1,
    borderColor: '#d9e1ee',
  },
  modeButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  modeButtonActive: {
    backgroundColor: colors.brandDeep,
  },
  modeButtonText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  modeButtonTextActive: {
    color: '#ffffff',
  },
  modeIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5f2',
  },
  modeIconActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  configNotice: {
    minHeight: 44,
    borderRadius: 8,
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
    fontWeight: '700',
  },
  field: {
    gap: 7,
  },
  fieldLabelRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  fieldIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  fieldLabel: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    minHeight: 50,
    borderRadius: 8,
    paddingHorizontal: 13,
    color: colors.ink,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dfe6f0',
    fontSize: 15,
    fontWeight: '700',
  },
  helperText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  switchRow: {
    minHeight: 56,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  switchIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  successText: {
    color: colors.brandDeep,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  submitButtonIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
});
