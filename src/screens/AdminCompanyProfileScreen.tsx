import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { AuthService } from '../services/auth';

export const AdminCompanyProfileScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  useEffect(() => {
    loadCompanyProfile();
  }, []);

  const loadCompanyProfile = async () => {
    setLoading(true);
    const profile = await AuthService.getCompanyProfile();
    if (profile) {
      setCompanyName(profile.name || '');
      setCompanyAddress(profile.address || '');
    }
    setLoading(false);
  };

  const handleSaveCompanyProfile = async () => {
    setLoading(true);
    try {
      await AuthService.updateCompanyProfile({ name: companyName, address: companyAddress });
      Alert.alert('Success', 'Company profile saved successfully!');
    } catch (e) {
      Alert.alert('Error', 'Failed to save company profile.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Company Profile</Text>
      <View style={styles.section}>
        <TextInput
          style={styles.input}
          placeholder="Company Name"
          value={companyName}
          onChangeText={setCompanyName}
          placeholderTextColor="#999"
        />
        <TextInput
          style={styles.input}
          placeholder="Company Address"
          value={companyAddress}
          onChangeText={setCompanyAddress}
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.button} onPress={handleSaveCompanyProfile}>
          <Text style={styles.buttonText}>Save Profile</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, backgroundColor: '#fafafa', color: '#555', fontWeight: '400' },
  button: { backgroundColor: '#007AFF', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
