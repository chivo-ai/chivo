import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LockKeyhole, Sparkles } from 'lucide-react-native';

import { hasSupabaseConfig } from '../../lib/config';
import { sendPasswordReset } from '../../services/auth';
import { colors } from '../../theme/tokens';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      await sendPasswordReset(email);
      setMessage('Reset email sent.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.shell}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Sparkles size={24} color="#ffffff" strokeWidth={2.5} />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.brandName}>Chivo AI</Text>
              <Text style={styles.brandMeta}>Reset your account password.</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.iconBox}>
              <LockKeyhole size={26} color={colors.tealDark} />
            </View>
            <Text style={styles.title}>Forgot password</Text>
            <Text style={styles.body}>Enter your email and Chivo AI will send a reset link.</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@school.com"
                placeholderTextColor="#8b9691"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={styles.input}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {message ? <Text style={styles.successText}>{message}</Text> : null}

            <Pressable
              disabled={!hasSupabaseConfig || loading}
              onPress={submit}
              style={[styles.submitButton, (!hasSupabaseConfig || loading) && styles.submitButtonDisabled]}
            >
              {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitButtonText}>Send reset email</Text>}
            </Pressable>

            <Link href="/(auth)/login" asChild>
              <Pressable style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Back to login</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 18,
    justifyContent: 'center',
  },
  shell: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: 18,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  flexText: {
    flex: 1,
  },
  brandName: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  brandMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    gap: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  body: {
    color: '#33413b',
    fontSize: 14,
    lineHeight: 21,
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
  submitButton: {
    minHeight: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  secondaryButtonText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
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
    fontWeight: '900',
  },
});
