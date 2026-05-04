import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  PixelRatio,
  Platform,
  Dimensions,
  Animated,
  Alert,
  ActivityIndicator,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useAuth } from "../context/AuthContext";
import { FirestoreService } from "../services/firestore";
import { AuthService } from "../services/auth";
import { Bill, ExpenseStats } from "../types";
import { Accelerometer } from "expo-sensors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const scale = SCREEN_WIDTH / 375; // Base width of 375 (iPhone X/11/12/13 Mini)

const normalize = (size: number) => {
  const newSize = size * scale;
  if (Platform.OS === "ios") {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  } else {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
  }
};

const BALL_SIZE = 30;
const BALL_RADIUS = BALL_SIZE / 2;

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userCoupons, setUserCoupons] = useState<any[]>([]);
  const [showCoupons, setShowCoupons] = useState(false);
  const [showRecent, setShowRecent] = useState(false);

  // Refs for ball animation and layout
  const vx = useRef(0);
  const vy = useRef(0);
  const px = useRef(SCREEN_WIDTH / 2);
  const py = useRef(Dimensions.get("window").height / 2);
  const ballXY = useRef(new Animated.ValueXY({ x: px.current - BALL_RADIUS, y: py.current - BALL_RADIUS })).current;
  const ballScale = useRef(new Animated.Value(1)).current;
  const triggered = useRef(false);
  const rootLayout = useRef({ width: 0, height: 0, x: 0, y: 0 });
  const buttonLayout = useRef({ width: 0, height: 0, x: 0, y: 0 });
  const cameraContainerY = useRef(0);

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    // Setup Accelerometer for ball
    triggered.current = false;
    Accelerometer.setUpdateInterval(16);
    const sub = Accelerometer.addListener(({ x, y }) => {
      // Invert axes so ball moves in the direction of the tilt
      vx.current = vx.current * 0.8 + (-x) * 2;
      vy.current = vy.current * 0.8 + y * 2;
    });

    let rafId: ReturnType<typeof requestAnimationFrame>;
    const tick = () => {
      px.current += vx.current;
      py.current += vy.current;

      const SW = rootLayout.current.width;
      const SH = rootLayout.current.height;

      // 80% bounds (centered on screen, leaving 10% margin on all sides)
      const minX = SW * 0.1 + BALL_RADIUS;
      const maxX = SW * 0.9 - BALL_RADIUS;
      const minY = SH * 0.1 + BALL_RADIUS;
      const maxY = SH * 0.9 - BALL_RADIUS;

      // Wall bounce with 80% limits
      if (px.current < minX) { px.current = minX; vx.current = Math.abs(vx.current) * 0.55; }
      if (px.current > maxX) { px.current = maxX; vx.current = -Math.abs(vx.current) * 0.55; }
      if (py.current < minY) { py.current = minY; vy.current = Math.abs(vy.current) * 0.55; }
      if (py.current > maxY) { py.current = maxY; vy.current = -Math.abs(vy.current) * 0.55; }

      // Friction
      vx.current *= 0.978;
      vy.current *= 0.978;

      // Update ball position
      ballXY.setValue({ x: px.current - BALL_RADIUS, y: py.current - BALL_RADIUS });

      // Collision check
      const bw = buttonLayout.current.width;
      const bh = buttonLayout.current.height;
      if (!triggered.current && bw > 0 && bh > 0) {
        // Calculate absolute center of the button
        const bx = buttonLayout.current.x + bw / 2;
        const by = cameraContainerY.current + buttonLayout.current.y + bh / 2;

        const dist = Math.hypot(px.current - bx, py.current - by);
        
        // If ball enters the center of the button (within 30px radius)
        if (dist < 30) {
          triggered.current = true;
          // Shrink ball into hole then fire callback
          Animated.spring(ballScale, {
            toValue: 0,
            speed: 30,
            useNativeDriver: true,
          }).start(() => {
            navigation.navigate("Camera");
            // Reset ball after navigation
            setTimeout(() => {
              triggered.current = false;
              px.current = SCREEN_WIDTH / 2;
              py.current = 100;
              ballScale.setValue(1);
            }, 1000);
          });
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      sub.remove();
      cancelAnimationFrame(rafId);
    };
  }, []);

  const loadData = async () => {
    console.log("loadData triggered for user:", user?.id);
    if (!user) {
      console.log("No user found, returning early");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      console.log("Fetching bills...");
      const userBills = await FirestoreService.getUserBills(user.id);
      
      console.log("Checking/Generating coupons...");
      await FirestoreService.checkAndGenerateCoupon(user.id);
      
      console.log("Fetching finalized stats and coupons...");
      const expenseStats = await FirestoreService.getExpenseStats(user.id);
      const coupons = await AuthService.getUserGeneratedCoupons(user.id);

      console.log("Data fetched successfully. Bills:", userBills.length, "Stats Coupons:", expenseStats.totalCoupons);
      setBills(userBills);
      setStats(expenseStats);
      setUserCoupons(coupons);
    } catch (error) {
      console.error("Error loading data:", error);
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
        <View
          style={[
            styles.billImage,
            {
              backgroundColor: "#f0f0f0",
              justifyContent: "center",
              alignItems: "center",
            },
          ]}
        >
          <Text style={{ fontSize: normalize(20) }}>📄</Text>
        </View>
      )}
      <View style={styles.billDetails}>
        <Text style={styles.billNumber}>Bill #{item.billNumber}</Text>
        <Text style={styles.billAmount}>₹{item.amount.toFixed(2)}</Text>
        <Text style={styles.billDate}>{item.date.toLocaleDateString()}</Text>
        {item.co2Saved && (
          <Text style={styles.billCo2}>🌱 {item.co2Saved}</Text>
        )}
      </View>
    </View>
  );

  return (
    <View 
      style={styles.container}
      onLayout={(e) => {
        rootLayout.current = e.nativeEvent.layout;
      }}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => navigation.navigate("Profile")}
        >
          {user?.photoUrl ? (
            <Image
              source={{ uri: user.photoUrl }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profileInitial}>
                {user?.name ? user.name[0].toUpperCase() : "U"}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.greeting}>
              Hello, {user?.name || "User"}! 👋
            </Text>
            {user?.role === 'admin' && (
              <TouchableOpacity onPress={() => navigation.navigate("AdminDashboard")}>
                <Text style={{color: '#007AFF', fontSize: 14, marginTop: 4, fontWeight: 'bold'}}>Go to Admin Dashboard →</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={{ flex: 1 }} 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              ₹{(stats?.totalExpenses || 0).toFixed(0)}
            </Text>
            <Text style={styles.statLabel}>Total Expenses</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.billCount || 0}</Text>
            <Text style={styles.statLabel}>Bills</Text>
          </View>
        </View>

        <View style={styles.co2Container}>
          <TouchableOpacity
            style={styles.co2Card}
            onPress={() => {
              const serializableBills = bills.map((b) => ({
                ...b,
                date: b.date instanceof Date ? b.date.toISOString() : b.date,
                createdAt:
                  b.createdAt instanceof Date
                    ? b.createdAt.toISOString()
                    : b.createdAt,
              }));
              navigation.navigate("CO2Summary", { bills: serializableBills });
            }}
          >
            <Text style={styles.co2Value}>
              {stats?.totalCo2Saved?.toFixed(2) || "0.00"} g
            </Text>
            <Text style={styles.co2Label}>Total CO2 Saved 🌱</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, showRecent && styles.sectionExpanded]}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setShowRecent((prev) => !prev)}
          >
            <Text style={styles.sectionTitle}>Recent Bills</Text>
            <Text style={styles.accordionIcon}>{showRecent ? "−" : "+"}</Text>
          </TouchableOpacity>

          {showRecent ? (
            <View>
              {bills.length > 0 ? (
                bills.map((item) => <View key={item.id}>{renderBillItem({ item })}</View>)
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    No bills yet. Tap the camera button to add one!
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </View>

        <View 
          style={styles.cameraContainer}
          onLayout={(e) => {
            cameraContainerY.current = e.nativeEvent.layout.y;
          }}
        >
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={() => Alert.alert("Play to Record", "Drop the Ball to the Button")}
            onLayout={(e) => {
               buttonLayout.current = e.nativeEvent.layout;
            }}
          >
            <Text style={styles.cameraIcon}>🧾</Text>
            <Text style={styles.cameraLabel}>Record Saved{"\n"}CO2</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rewardsSummaryContainer}>
          <TouchableOpacity 
            style={styles.rewardsCard}
            onPress={() => setShowCoupons(!showCoupons)}
          >
            <View style={styles.rewardsHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.rewardsTitle}>🎁 Rewards Summary</Text>
                {userCoupons.length > 0 && <Text style={styles.totalCouponsBadge}>{stats?.totalCoupons || 0} Total</Text>}
              </View>
              <Text style={styles.accordionIcon}>{showCoupons ? "−" : "+"}</Text>
            </View>
            
            <View style={styles.rewardsRow}>
              <View style={styles.rewardStat}>
                <Text style={[styles.rewardStatValue, { color: '#34C759' }]}>
                  {stats?.redeemedCoupons || 0}
                </Text>
                <Text style={styles.rewardStatLabel}>Redeemed</Text>
              </View>
              <View style={styles.rewardDivider} />
              <View style={styles.rewardStat}>
                <Text style={[styles.rewardStatValue, { color: '#FF9500' }]}>
                  {stats?.openCoupons || 0}
                </Text>
                <Text style={styles.rewardStatLabel}>Open</Text>
              </View>
            </View>

            {showCoupons && userCoupons.length > 0 && (
              <View style={styles.integratedCouponList}>
                <View style={styles.integratedDivider} />
                <Text style={styles.integratedSubTitle}>Available Coupons:</Text>
                {userCoupons.map((coupon) => (
                  <View key={coupon.id} style={styles.integratedCouponItem}>
                    <Text style={styles.integratedCouponCode}>{coupon.code}</Text>
                    <Text style={styles.integratedCouponDate}>
                      Earned: {new Date(coupon.createdAt.toDate ? coupon.createdAt.toDate() : coupon.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
                <Text style={styles.couponHint}>Use these codes in the reward partner app!</Text>
              </View>
            )}
            
            {showCoupons && userCoupons.length === 0 && (
              <View style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={{ color: '#666', fontStyle: 'italic' }}>No coupons earned yet. Keep saving CO2!</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Padding for ball space */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Global Ball Overlay */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ball,
          {
            transform: [
              { translateX: ballXY.x },
              { translateY: ballXY.y },
              { scale: ballScale },
            ],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#fff",
    padding: 20,
    paddingTop: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
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
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitial: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  greeting: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: "#FF3B30",
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#E8F5E9",
    padding: 12,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  statValue: {
    fontSize: normalize(16),
    fontWeight: "bold",
    color: "#007AFF",
  },
  statLabel: {
    fontSize: normalize(12),
    color: "#666",
    marginTop: 4,
  },
  co2Container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  co2Card: {
    backgroundColor: "#E8F5E9", // Light green background
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  co2Value: {
    fontSize: normalize(24),
    fontWeight: "bold",
    color: "#2E7D32", // Dark green text
  },
  co2Label: {
    fontSize: normalize(14),
    color: "#388E3C",
    marginTop: 4,
    fontWeight: "500",
  },
  rewardsSummaryContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  rewardsCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  rewardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
    paddingBottom: 8,
  },
  rewardsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalCouponsBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007AFF',
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rewardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  rewardStat: {
    alignItems: 'center',
    flex: 1,
  },
  rewardStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  rewardStatLabel: {
    fontSize: 12,
    color: '#666',
  },
  rewardDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#C8E6C9',
  },
  integratedCouponList: {
    marginTop: 16,
    paddingTop: 8,
  },
  integratedDivider: {
    height: 1,
    backgroundColor: '#C8E6C9',
    marginBottom: 12,
  },
  integratedSubTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  integratedCouponItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200, 230, 201, 0.5)',
  },
  integratedCouponCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 0.5,
  },
  integratedCouponDate: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionExpanded: {
    flex: 1,
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: normalize(16),
    fontWeight: "bold",
    color: "#000",
  },
  accordionIcon: {
    fontSize: normalize(20),
    fontWeight: "600",
    color: "#007AFF",
  },
  collapsedHint: {
    fontSize: 14,
    color: "#666",
    paddingVertical: 8,
  },
  billCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: normalize(8),
    marginBottom: normalize(8),
    flexDirection: "row",
  },
  billImage: {
    width: normalize(40),
    height: normalize(40),
    borderRadius: 8,
  },
  billDetails: {
    flex: 1,
    marginLeft: normalize(12),
    justifyContent: "center",
  },
  billNumber: {
    fontSize: normalize(12),
    fontWeight: "600",
    marginBottom: 4,
    color: "#000",
  },
  billAmount: {
    fontSize: normalize(14),
    fontWeight: "bold",
    color: "#34C759",
    marginBottom: 4,
  },
  billRoute: {
    fontSize: normalize(14),
    color: "#666",
    marginBottom: 2,
  },
  billDate: {
    fontSize: normalize(12),
    color: "#999",
  },
  billCo2: {
    fontSize: normalize(12),
    color: "#2E7D32",
    marginTop: 2,
    fontWeight: "500",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  cameraContainer: {
    paddingVertical: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
  },
  cameraButton: {
    width: 140,
    height: 96,
    borderRadius: 24,
    backgroundColor: "#2E7D32", // Dark green to match CO2 saved
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
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
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
  ball: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_RADIUS,
    backgroundColor: 'transparent',
    borderWidth: 3.5, // Thick border
    borderColor: '#4ade80', // Light green
    shadowColor: '#4ade80', // Slight green glow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  couponSection: {
    backgroundColor: '#E8F5E9',
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  couponList: {
    padding: 16,
    backgroundColor: 'transparent',
  },
  couponItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
  },
  couponCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 1,
  },
  couponDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  couponHint: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
});

