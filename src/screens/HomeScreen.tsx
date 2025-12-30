import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  Dimensions,
  PixelRatio,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { FirestoreService } from '../services/firestore';
import { Bill, ExpenseStats } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375; // Base width of 375 (iPhone X/11/12/13 Mini)

const normalize = (size: number) => {
  const newSize = size * scale;
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  } else {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
  }
};

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
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.billImage} />
      ) : (
        <View style={[styles.billImage, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ fontSize: normalize(20) }}>📄</Text>
        </View>
      )}
      <View style={styles.billDetails}>
        <Text style={styles.billNumber}>Bill #{item.billNumber}</Text>
        <Text style={styles.billAmount}>₹{item.amount.toFixed(2)}</Text>
        {/* <Text style={styles.billRoute}>
          {item.from} → {item.to}
        </Text> */}
        <Text style={styles.billDate}>
          {item.date.toLocaleDateString()}
        </Text>
        {item.co2Saved && (
          <Text style={styles.billCo2}>
            🌱 {item.co2Saved}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.userInfo} 
          onPress={() => navigation.navigate('Profile')}
        >
          {user?.photoUrl ? (
            <Image source={{ uri: user.photoUrl }} style={styles.profileImage} />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profileInitial}>
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.greeting}>Hello, {user?.name || 'User'}! 👋</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {stats && (
        <>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>₹{stats.totalExpenses.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Total Expenses</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.billCount}</Text>
              <Text style={styles.statLabel}>Bills</Text>
            </View>
          </View>

          <View style={styles.co2Container}>
            <TouchableOpacity 
              style={styles.co2Card}
              onPress={() => {
                // Convert dates to strings to avoid non-serializable warning
                const serializableBills = bills.map(b => ({
                  ...b,
                  date: b.date instanceof Date ? b.date.toISOString() : b.date,
                  createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
                }));
                navigation.navigate('CO2Summary', { bills: serializableBills });
              }}
            >
              <Text style={styles.co2Value}>{stats.totalCo2Saved?.toFixed(2) || '0.00'} g</Text>
              <Text style={styles.co2Label}>Total CO2 Saved 🌱</Text>
            </TouchableOpacity>
          </View>
        </>
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
        ) : null}
      </View>

      <View style={styles.cameraContainer}>
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={() => navigation.navigate('Camera')}
        >
          <Text style={styles.cameraIcon}>🧾</Text>
          <Text style={styles.cameraLabel}>Record Saved{'\n'}CO2</Text>
        </TouchableOpacity>
        {/* <TouchableOpacity
          style={styles.cameraButton}
          onPress={() => navigation.navigate('QRScanner')}
        >
          <Text style={styles.cameraIcon}>🔳</Text>
          <Text style={styles.cameraLabel}>Scan QR</Text>
        </TouchableOpacity> */}
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  profilePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
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
    padding: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: normalize(14),
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: normalize(10),
    color: '#666',
    marginTop: 4,
  },
  co2Container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  co2Card: {
    backgroundColor: '#E8F5E9', // Light green background
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  co2Value: {
    fontSize: normalize(24),
    fontWeight: 'bold',
    color: '#2E7D32', // Dark green text
  },
  co2Label: {
    fontSize: normalize(14),
    color: '#388E3C',
    marginTop: 4,
    fontWeight: '500',
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
    fontSize: normalize(24),
    fontWeight: '600',
    color: '#000',
  },
  sectionTitle: {
    fontSize: normalize(16),
    fontWeight: 'bold',
    color: '#000',
  },
  collapsedHint: {
    fontSize: 14,
    color: '#666',
    paddingVertical: 8,
  },
  billCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: normalize(8),
    marginBottom: normalize(8),
    flexDirection: 'row',
  },
  billImage: {
    width: normalize(40),
    height: normalize(40),
    borderRadius: 8,
  },
  billDetails: {
    flex: 1,
    marginLeft: normalize(12),
    justifyContent: 'center',
  },
  billNumber: {
    fontSize: normalize(12),
    fontWeight: '600',
    marginBottom: 4,
    color: '#000',
  },
  billAmount: {
    fontSize: normalize(14),
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 4,
  },
  billRoute: {
    fontSize: normalize(14),
    color: '#666',
    marginBottom: 2,
  },
  billDate: {
    fontSize: normalize(12),
    color: '#999',
  },
  billCo2: {
    fontSize: normalize(12),
    color: '#2E7D32',
    marginTop: 2,
    fontWeight: '500',
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
    width: 140,
    height: 96,
    borderRadius: 24,
    backgroundColor: '#2E7D32', // Dark green to match CO2 saved
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    gap: 8,
    padding: 4,
  },
  cameraIcon: {
    fontSize: 26,
  },
  cameraLabel: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
});
