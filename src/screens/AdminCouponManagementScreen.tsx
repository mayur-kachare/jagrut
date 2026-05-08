import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Switch } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { AuthService } from '../services/auth';

export const AdminCouponManagementScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  
  // Reward System Settings
  const [co2Threshold, setCo2Threshold] = useState('');
  const [rewardActive, setRewardActive] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const settings = await AuthService.getCouponSettings();
    if (settings) {
      setCo2Threshold(settings.co2Threshold?.toString() || '');
      setRewardActive(settings.active !== false);
    }
    setLoading(false);
  };

  const handleSaveCoupon = async () => {
    if (!couponCode || !discountAmount) {
      Alert.alert('Error', 'Please enter code and discount');
      return;
    }
    setLoading(true);
    try {
      await AuthService.saveCoupon(couponCode, discountAmount);
      Alert.alert('Success', 'Coupon code saved successfully!');
      setCouponCode('');
      setDiscountAmount('');
    } catch (e) {
      Alert.alert('Error', 'Failed to save coupon.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveThreshold = async () => {
    if (!co2Threshold) {
      Alert.alert('Error', 'Please enter a valid threshold');
      return;
    }
    setLoading(true);
    try {
      await AuthService.updateCouponSettings({
        co2Threshold: parseFloat(co2Threshold),
        active: rewardActive
      });
      Alert.alert('Success', 'Threshold settings updated!');
    } catch (e) {
      Alert.alert('Error', 'Failed to update settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Coupon & Rewards</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Coupons</Text>
        <TextInput
          style={styles.input}
          placeholder="Coupon Code (e.g. SAVE20)"
          value={couponCode}
          onChangeText={setCouponCode}
          autoCapitalize="characters"
          placeholderTextColor="#999"
        />
        <TextInput
          style={styles.input}
          placeholder="Discount Amount / Percentage"
          value={discountAmount}
          onChangeText={setDiscountAmount}
          keyboardType="numeric"
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.button} onPress={handleSaveCoupon} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save Manual Coupon'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { marginTop: 20 }]}>
        <Text style={styles.sectionTitle}>Automatic Reward System</Text>
        <Text style={styles.label}>CO2 Savings Threshold (in grams)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 500"
          value={co2Threshold}
          onChangeText={setCo2Threshold}
          keyboardType="numeric"
          placeholderTextColor="#999"
        />
        
        <View style={styles.switchRow}>
          <Text style={styles.label}>Enable Reward Generation</Text>
          <Switch
            value={rewardActive}
            onValueChange={setRewardActive}
            trackColor={{ false: "#767577", true: "#34C759" }}
            thumbColor={rewardActive ? "#fff" : "#f4f3f4"}
          />
        </View>

        <TouchableOpacity style={[styles.button, { backgroundColor: '#5856D6' }]} onPress={handleSaveThreshold} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Updating...' : 'Save Reward Settings'}</Text>
        </TouchableOpacity>
        
        <Text style={styles.hintText}>
          When a user reaches this CO2 threshold, a random 14-20 character coupon will be automatically generated for them.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#007AFF' },
  label: { fontSize: 14, color: '#666', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, backgroundColor: '#fafafa', color: '#555', fontWeight: '400' },
  button: { backgroundColor: '#007AFF', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  hintText: { fontSize: 12, color: '#888', marginTop: 15, fontStyle: 'italic' },
});
