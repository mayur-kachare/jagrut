import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { FirestoreService } from '../services/firestore';
import { Bill, ExpenseStats } from '../types';

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user) return;

    try {
      const [userBills, expenseStats] = await Promise.all([
        FirestoreService.getUserBills(user.id),
        FirestoreService.getExpenseStats(user.id),
      ]);

      setBills(userBills);
      setStats(expenseStats);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = async () => {
    await logout();
  };

  const renderBillItem = ({ item }: { item: Bill }) => (
    <View style={styles.billCard}>
      <Image source={{ uri: item.imageUrl }} style={styles.billImage} />
      <View style={styles.billDetails}>
        <Text style={styles.billNumber}>Bill #{item.billNumber}</Text>
        <Text style={styles.billAmount}>₹{item.amount.toFixed(2)}</Text>
        <Text style={styles.billRoute}>
          {item.from} → {item.to}
        </Text>
        <Text style={styles.billDate}>
          {item.date.toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello! 👋</Text>
          <Text style={styles.phoneNumber}>{user?.phoneNumber}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>₹{stats.totalExpenses.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Total Expenses</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.billCount}</Text>
            <Text style={styles.statLabel}>Bills</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalDistance} km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
        </View>
      )}

      <View style={[styles.section, showRecent && styles.sectionExpanded]}>
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => setShowRecent((prev) => !prev)}
        >
          <Text style={styles.sectionTitle}>Recent Bills</Text>
          <Text style={styles.accordionIcon}>{showRecent ? '−' : '+'}</Text>
        </TouchableOpacity>

        {showRecent ? (
          <FlatList
            data={bills}
            renderItem={renderBillItem}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No bills yet. Tap the camera button to add one!
                </Text>
              </View>
            }
          />
        ) : (
          <Text style={styles.collapsedHint}>Tap + to view bills</Text>
        )}
      </View>

      <View style={styles.cameraContainer}>
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={() => navigation.navigate('Camera')}
        >
          <Text style={styles.cameraIcon}>📷</Text>
          <Text style={styles.cameraLabel}>Capture Bill</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={() => navigation.navigate('QRScanner')}
        >
          <Text style={styles.cameraIcon}>🔳</Text>
          <Text style={styles.cameraLabel}>Scan QR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  phoneNumber: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionExpanded: {
    flex: 1,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  accordionIcon: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  collapsedHint: {
    fontSize: 14,
    color: '#666',
    paddingVertical: 8,
  },
  billCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
  },
  billImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  billDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  billNumber: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  billAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 4,
  },
  billRoute: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  billDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  cameraContainer: {
    paddingVertical: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  cameraButton: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    gap: 8,
  },
  cameraIcon: {
    fontSize: 32,
  },
  cameraLabel: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});
