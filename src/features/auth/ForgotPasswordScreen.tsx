import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowRight, LogIn, LockKeyhole, Mail, Sparkles } from 'lucide-react-native';

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
              <Text style={styles.brandName} numberOfLines={1}>Chivo AI</Text>
              <Text style={styles.brandMeta} numberOfLines={1}>Reset your account password.</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.iconBox}>
              <LockKeyhole size={26} color={colors.brandDeep} />
            </View>
            <Text style={styles.title} numberOfLines={1}>Forgot password</Text>
            <Text style={styles.body} numberOfLines={2}>Enter your email and Chivo AI will send a reset link.</Text>

            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <View style={styles.fieldIcon}>
                  <Mail size={15} color={colors.brandDeep} />
                </View>
                <Text style={styles.fieldLabel} numberOfLines={1}>Email</Text>
              </View>
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
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.submitButtonText} numberOfLines={1}>Send reset email</Text>
                  <View style={styles.submitButtonIcon}>
                    <ArrowRight size={16} color="#ffffff" />
                  </View>
                </>
              )}
            </Pressable>

            <Link href="/(auth)/login" asChild>
              <Pressable style={styles.secondaryButton}>
                <LogIn size={15} color={colors.brandDeep} />
                <Text style={styles.secondaryButtonText} numberOfLines={1}>Back to login</Text>
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
    backgroundColor: colors.brandDeep,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 14,
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
    gap: 10,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  flexText: {
    flex: 1,
  },
  brandName: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  brandMeta: {
    color: '#a8b3c7',
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 8,
    padding: 18,
    gap: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softBlue,
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
    lineHeight: 19,
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
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: colors.ink,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dfe6f0',
    fontSize: 15,
  },
  submitButton: {
    minHeight: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  submitButtonIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.softBlue,
  },
  secondaryButtonText: {
    color: colors.brandDeep,
    fontSize: 13,
    fontWeight: '700',
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
});
