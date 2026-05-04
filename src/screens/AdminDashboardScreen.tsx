import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useAuth } from '../context/AuthContext';

export const AdminDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { logout } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('AdminCompanyProfile')}>
          <Text style={styles.menuButtonText}>Company Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.menuButtonText}>Update Profile & Password</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('AdminUserManagement')}>
          <Text style={styles.menuButtonText}>User Management</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('AdminCouponManagement')}>
          <Text style={styles.menuButtonText}>Coupon Code Management</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, marginTop: 10 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  logoutButton: { padding: 8, backgroundColor: '#FF3B30', borderRadius: 8 },
  logoutText: { color: '#fff', fontWeight: 'bold' },
  menuContainer: { gap: 16 },
  menuButton: { backgroundColor: '#fff', padding: 20, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderLeftWidth: 4, borderLeftColor: '#007AFF' },
  menuButtonText: { fontSize: 18, fontWeight: '600', color: '#333' },
});
