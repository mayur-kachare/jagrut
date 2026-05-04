import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/auth';

export const LoginScreen: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'adminPassword' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const { login, sendOTP } = useAuth();

  const handleSendOTP = async () => {
    const isAdmin = phoneNumber.toLowerCase().trim() === 'admin';
    if (!isAdmin && phoneNumber.length < 3) {
      Alert.alert('Error', 'Enter valid username or mobile number');
      return;
    }

    if (isAdmin) {
      setStep('adminPassword');
      return;
    }

    setLoading(true);
    try {
      const success = await sendOTP(phoneNumber);
      if (success) {
        setStep('otp');
        Alert.alert('Success', 'OTP sent successfully! (Use 123456)');
      } else {
        Alert.alert('Error', 'Failed to send OTP');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAdminPassword = async () => {
    setLoading(true);
    try {
      const isValid = await AuthService.verifyAdminPassword(adminPassword);
      if (!isValid) {
        Alert.alert('Error', 'Invalid Admin Password');
        setLoading(false);
        return;
      }

      const success = await sendOTP(phoneNumber);
      if (success) {
        setStep('otp');
        Alert.alert('Success', 'OTP sent to Admin Mobile! (Use 123456)');
      } else {
        Alert.alert('Error', 'Failed to send OTP');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const success = await login(phoneNumber, otp);
      if (!success) {
        Alert.alert('Error', 'Invalid OTP');
      }
    } catch (error) {
      Alert.alert('Error', 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Jagrut</Text>
        <Text style={styles.subtitle}>Bill Management & Analytics</Text>

        <View style={styles.form}>
          {step === 'phone' && (
            <>

              <TextInput
                style={styles.input}
                placeholder="Username or Mobile No"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="default"
                autoCapitalize="none"
                underlineColorAndroid="transparent"
                placeholderTextColor="#000"
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Processing...' : 'Next'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'adminPassword' && (
            <>
              <Text style={styles.label}>Admin Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter Admin Password"
                value={adminPassword}
                onChangeText={setAdminPassword}
                secureTextEntry
                underlineColorAndroid="transparent"
                placeholderTextColor="#000"
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyAdminPassword}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Verifying...' : 'Verify Password'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resendButton}
                onPress={() => setStep('phone')}
              >
                <Text style={styles.resendText}>Go Back</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'otp' && (
            <>
              <Text style={styles.label}>Enter OTP</Text>
              <TextInput
                style={styles.input}
                placeholder="123456"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                underlineColorAndroid="transparent"
                placeholderTextColor="#000"
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyOTP}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resendButton}
                onPress={() => setStep('phone')}
              >
                <Text style={styles.resendText}>Change Number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    color: '#000',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendText: {
    color: '#007AFF',
    fontSize: 14,
  },
});
