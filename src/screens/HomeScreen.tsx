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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SplashScreen } from "./SplashScreen";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const scale = SCREEN_WIDTH / 375; 

const ENV_MESSAGES = [
  "Every metro ride reduces your carbon footprint by up to 80% compared to a car! 🌍",
  "Small steps, giant impact. Your green travel is healing the planet. 🌱",
  "You've saved enough CO2 to give a young tree a fresh start today! 🌳",
  "Green travel isn't just a choice; it's a legacy for the future. ♻️",
  "Each gram of CO2 you save is a breath of fresh air for our city. 🏙️",
  "Your travel choices today are shaping a cooler, greener world for tomorrow. 🌬️",
  "Metro travel: The smartest, greenest way to move. Thanks for leading the way! 🚄",
  "Every ticket scanned is a win for the environment. Keep up the great work! 🌏",
  "You're a climate hero! Your CO2 savings are making a real difference. 🦸‍♂️",
  "Think globally, act locally. Your green commute is doing just that! 🍃",
  "Carbon neutral is the goal, and you're helping us get there one ride at a time. 🏁",
  "Less smog, more oxygen. Your green travel is a breath of fresh air. 💨",
  "Small changes in how we travel lead to big changes for our planet. 🔄",
  "Did you know? One metro trip can save over 500g of CO2. You're doing amazing! ✨",
  "Sustainability looks good on you! Keep saving, keep shining. 🌟",
];

const TUTORIAL_STEPS = [
  {
    title: "Welcome to Jagrut! 🌱",
    content: "Thank you for joining the movement to save our planet. Let's walk through how you can make an impact.",
    target: "none"
  },
  {
    title: "Track Your Impact 📊",
    content: "This section shows your total expenses and CO2 saved. Every gram counts towards a greener tomorrow!",
    target: "stats"
  },
  {
    title: "Record Saved CO2 📷",
    content: "Tap this green button to scan your metro ticket/bill. Our AI automatically calculates your CO2 savings!",
    target: "button"
  },
  {
    title: "Earn Rewards 🎁",
    content: "Once you save enough CO2, you'll automatically earn reward coupons here. Green travel pays off!",
    target: "rewards"
  }
];

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
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [randomMessage, setRandomMessage] = useState("");
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const checkTutorial = async () => {
      const hasSeen = await AsyncStorage.getItem("hasSeenTutorial");
      if (!hasSeen) {
        setShowTutorial(true);
      }
    };
    checkTutorial();
    setRandomMessage(ENV_MESSAGES[Math.floor(Math.random() * ENV_MESSAGES.length)]);

    // Auto-scroll messages every 30 seconds
    const interval = setInterval(() => {
      setRandomMessage(ENV_MESSAGES[Math.floor(Math.random() * ENV_MESSAGES.length)]);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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
  const headerHeight = useRef(0);
  const scrollOffset = useRef(0);

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    triggered.current = false;
    Accelerometer.setUpdateInterval(16);
    const sub = Accelerometer.addListener(({ x, y }) => {
      vx.current = vx.current * 0.8 + (-x) * 2;
      vy.current = vy.current * 0.8 + y * 2;
    });

    let rafId: ReturnType<typeof requestAnimationFrame>;
    const tick = () => {
      px.current += vx.current;
      py.current += vy.current;

      const SW = rootLayout.current.width;
      const SH = rootLayout.current.height;

      const minX = SW * 0.1 + BALL_RADIUS;
      const maxX = SW * 0.9 - BALL_RADIUS;
      const minY = SH * 0.1 + BALL_RADIUS;
      const maxY = SH * 0.9 - BALL_RADIUS;

      if (px.current < minX) { px.current = minX; vx.current = Math.abs(vx.current) * 0.55; }
      if (px.current > maxX) { px.current = maxX; vx.current = -Math.abs(vx.current) * 0.55; }
      if (py.current < minY) { py.current = minY; vy.current = Math.abs(vy.current) * 0.55; }
      if (py.current > maxY) { py.current = maxY; vy.current = -Math.abs(vy.current) * 0.55; }

      vx.current *= 0.978;
      vy.current *= 0.978;

      ballXY.setValue({ x: px.current - BALL_RADIUS, y: py.current - BALL_RADIUS });

      const bw = buttonLayout.current.width;
      const bh = buttonLayout.current.height;
      if (!triggered.current && bw > 0 && bh > 0) {
        const bx = buttonLayout.current.x + bw / 2;
        const by = headerHeight.current + cameraContainerY.current + buttonLayout.current.y + bh / 2 - scrollOffset.current;
        
        const dx = px.current - bx;
        const dy = py.current - by;
        const dist = Math.hypot(dx, dy);
        
        // Magnetic pull when close
        if (dist < 100) {
          vx.current -= dx * 0.05;
          vy.current -= dy * 0.05;
        }

        if (dist < 40) { // Increased radius for better accessibility
          triggered.current = true;
          Animated.spring(ballScale, {
            toValue: 0,
            speed: 30,
            useNativeDriver: true,
          }).start(() => {
            navigation.navigate("Camera");
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
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setRandomMessage(ENV_MESSAGES[Math.floor(Math.random() * ENV_MESSAGES.length)]);
      const userBills = await FirestoreService.getUserBills(user.id);
      await FirestoreService.checkAndGenerateCoupon(user.id);
      const expenseStats = await FirestoreService.getExpenseStats(user.id);
      const coupons = await AuthService.getUserGeneratedCoupons(user.id);
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

  const nextTutorialStep = async () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowTutorial(false);
      await AsyncStorage.setItem("hasSeenTutorial", "true");
    }
  };

  const skipTutorial = async () => {
    setShowTutorial(false);
    await AsyncStorage.setItem("hasSeenTutorial", "true");
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderBillItem = ({ item }: { item: Bill }) => (
    <View style={styles.billCard}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.billImage} />
      ) : (
        <View style={[styles.billImage, { backgroundColor: "#f0f0f0", justifyContent: "center", alignItems: "center" }]}>
          <Text style={{ fontSize: normalize(20) }}>📄</Text>
        </View>
      )}
      <View style={styles.billDetails}>
        <Text style={styles.billNumber}>Bill #{item.billNumber}</Text>
        <Text style={styles.billAmount}>₹{item.amount.toFixed(2)}</Text>
        <Text style={styles.billDate}>{item.date.toLocaleDateString()}</Text>
        {item.co2Saved && <Text style={styles.billCo2}>🌱 {item.co2Saved}</Text>}
      </View>
    </View>
  );

  const renderTutorial = () => {
    if (!showTutorial) return null;
    const step = TUTORIAL_STEPS[currentStep];
    return (
      <View style={styles.tutorialOverlay}>
        <View style={styles.tutorialCard}>
          <Text style={styles.tutorialTitle}>{step.title}</Text>
          <Text style={styles.tutorialContent}>{step.content}</Text>
          <View style={styles.tutorialFooter}>
            <TouchableOpacity onPress={skipTutorial}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextButton} onPress={nextTutorialStep}>
              <Text style={styles.nextButtonText}>
                {currentStep === TUTORIAL_STEPS.length - 1 ? "Get Started!" : "Next"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <View 
      style={styles.container}
      onLayout={(e) => { rootLayout.current = e.nativeEvent.layout; }}
    >
      <View 
        style={styles.header}
        onLayout={(e) => { headerHeight.current = e.nativeEvent.layout.height; }}
      >
        <TouchableOpacity style={[styles.userInfo, { flex: 1 }]} onPress={() => navigation.navigate("Profile")}>
          {user?.photoUrl ? (
            <Image source={{ uri: user.photoUrl }} style={styles.profileImage} />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profileInitial}>{user?.name ? user.name[0].toUpperCase() : "U"}</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.userNameText}>Hello, {user?.name || user?.phoneNumber}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={{ flex: 1 }} 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
      >
        {/* Motivational Banner */}
        <View style={styles.motivationalCard}>
          <Text style={styles.motivationalEmoji}>✨</Text>
          <Text style={styles.motivationalText}>{randomMessage}</Text>
        </View>

        <View style={styles.trainContainer}>
          <View style={styles.trainCompartment}>
            <Text style={styles.trainValue}>₹{(stats?.totalExpenses || 0).toFixed(0)}</Text>
            <Text style={styles.trainLabel}>Expenses</Text>
          </View>
          <View style={styles.trainConnector} />
          <View style={styles.trainCompartment}>
            <Text style={styles.trainValue}>{stats?.billCount || 0}</Text>
            <Text style={styles.trainLabel}>Bills</Text>
          </View>
          <View style={styles.trainConnector} />
          <TouchableOpacity 
            style={[styles.trainCompartment, styles.trainEngine]}
            onPress={() => {
              const serializableBills = bills.map((b) => ({
                ...b,
                date: b.date instanceof Date ? b.date.toISOString() : b.date,
                createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
              }));
              navigation.navigate("CO2Summary", { bills: serializableBills });
            }}
          >
            <View style={styles.engineWindow} />
            <Text style={styles.trainValue}>{stats?.totalCo2Saved?.toFixed(1) || "0"} g</Text>
            <Text style={[styles.trainLabel, { fontSize: 8 }]}>Total CO2 Saved</Text>
            <View style={styles.engineHeadlight} />
          </TouchableOpacity>
        </View>

        <View 
          style={styles.cameraContainer}
          onLayout={(e) => { cameraContainerY.current = e.nativeEvent.layout.y; }}
        >
          <TouchableOpacity 
            style={styles.leafButton}
            onLayout={(e) => { buttonLayout.current = e.nativeEvent.layout; }}
            onPress={() => Alert.alert("Record Saved CO2", "Move the ball to the button to record.")}
          >
            <Text style={styles.cameraIcon}>🧾</Text>
            <Text style={styles.cameraLabel}>Record Saved{"\n"}CO2</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setShowRecent((prev) => !prev)}
          >
            <Text style={styles.sectionTitle}>Recent Bills</Text>
            <Text style={styles.accordionIcon}>{showRecent ? "−" : "+"}</Text>
          </TouchableOpacity>

          {showRecent ? (
            <View style={styles.billList}>
              {bills.length > 0 ? (
                bills.map((item) => <View key={item.id}>{renderBillItem({ item })}</View>)
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No bills yet. Tap the camera button to add one!</Text>
                </View>
              )}
            </View>
          ) : null}
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
                <Text style={[styles.rewardStatValue, { color: '#34C759' }]}>{stats?.redeemedCoupons || 0}</Text>
                <Text style={styles.rewardStatLabel}>Redeemed</Text>
              </View>
              <View style={styles.rewardDivider} />
              <View style={styles.rewardStat}>
                <Text style={[styles.rewardStatValue, { color: '#FF9500' }]}>{stats?.openCoupons || 0}</Text>
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
        
        <View style={{ height: 100 }} />
      </ScrollView>

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
      >
        <View style={styles.ballHighlight} />
      </Animated.View>
      {renderTutorial()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: { backgroundColor: "#fff", padding: 16, paddingTop: 50, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerInfo: { marginLeft: 12, flexShrink: 1 },
  userNameText: { fontSize: 14, fontWeight: "bold", color: "#000" },
  userInfo: { flexDirection: "row", alignItems: "center" },
  profileImage: { width: 44, height: 44, borderRadius: 22 },
  profilePlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#007AFF", justifyContent: "center", alignItems: "center" },
  profileInitial: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  logoutButton: { padding: 4 },
  logoutText: { color: "#FF3B30", fontSize: 13, fontWeight: "600" },
  motivationalCard: { backgroundColor: "#E3F2FD", marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#BBDEFB" },
  motivationalEmoji: { fontSize: 20, marginRight: 10 },
  motivationalText: { flex: 1, fontSize: 13, color: "#1976D2", lineHeight: 18, fontWeight: "500", fontStyle: "italic" },
  trainContainer: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 16, alignItems: "center" },
  trainCompartment: { flex: 1, backgroundColor: "#E8F5E9", paddingVertical: 12, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#C8E6C9", elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  trainEngine: { borderTopRightRadius: 45, borderBottomRightRadius: 45, borderLeftWidth: 0, paddingRight: 8, overflow: 'hidden' },
  engineWindow: { position: 'absolute', top: 0, right: 0, width: '40%', height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.3)', borderTopRightRadius: 45, borderBottomRightRadius: 45 },
  engineHeadlight: { position: 'absolute', bottom: 10, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFEB3B', shadowColor: '#FFEB3B', shadowRadius: 10, shadowOpacity: 1, elevation: 10 },
  trainValue: { fontSize: normalize(16), fontWeight: "bold", color: "#2E7D32", zIndex: 2 },
  trainLabel: { fontSize: normalize(8.5), color: "#388E3C", marginTop: 2, fontWeight: "700", textTransform: "uppercase", zIndex: 2 },
  trainConnector: { width: 6, height: 4, backgroundColor: "#C8E6C9", marginHorizontal: -1, zIndex: -1 },
  cameraContainer: { paddingVertical: 24, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  leafButton: { width: 140, height: 100, borderTopLeftRadius: 70, borderBottomRightRadius: 70, borderTopRightRadius: 20, borderBottomLeftRadius: 20, backgroundColor: "#2E7D32", justifyContent: "center", alignItems: "center", elevation: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, gap: 4, overflow: 'hidden' },
  cameraIcon: { fontSize: 28 },
  cameraLabel: { fontSize: 13, color: "#fff", fontWeight: "bold", textAlign: "center", paddingHorizontal: 10 },
  leafSubMessage: { fontSize: 8, color: "rgba(255, 255, 255, 0.8)", fontWeight: "600", textTransform: "uppercase", marginTop: -2 },
  section: { paddingHorizontal: 16, paddingBottom: 16 },
  accordionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  sectionTitle: { fontSize: normalize(16), fontWeight: "bold", color: "#000" },
  accordionIcon: { fontSize: normalize(20), fontWeight: "600", color: "#007AFF" },
  billList: { marginTop: 8 },
  billCard: { backgroundColor: "#fff", padding: 12, borderRadius: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  billImage: { width: 50, height: 50, borderRadius: 8 },
  billDetails: { flex: 1, marginLeft: 12 },
  billNumber: { fontSize: 14, fontWeight: "bold", color: "#333" },
  billAmount: { fontSize: 16, fontWeight: "bold", color: "#007AFF", marginVertical: 2 },
  billDate: { fontSize: 11, color: "#666" },
  billCo2: { fontSize: 12, color: "#2E7D32", fontWeight: "600", marginTop: 2 },
  emptyContainer: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#666", textAlign: "center" },
  rewardsSummaryContainer: { paddingHorizontal: 16, marginBottom: 16 },
  rewardsCard: { backgroundColor: "#E8F5E9", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#C8E6C9" },
  rewardsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#C8E6C9", paddingBottom: 8 },
  rewardsTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  totalCouponsBadge: { backgroundColor: "#C8E6C9", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 12, color: "#2E7D32", fontWeight: "bold", marginLeft: 8 },
  rewardsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  rewardStat: { alignItems: "center" },
  rewardStatValue: { fontSize: 22, fontWeight: "bold" },
  rewardStatLabel: { fontSize: 12, color: "#666", marginTop: 2 },
  rewardDivider: { width: 1, height: 30, backgroundColor: "#C8E6C9" },
  integratedCouponList: { marginTop: 16, paddingTop: 8 },
  integratedDivider: { height: 1, backgroundColor: "#C8E6C9", marginBottom: 12 },
  integratedSubTitle: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 },
  integratedCouponItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(200, 230, 201, 0.5)" },
  integratedCouponCode: { fontSize: 16, fontWeight: "bold", color: "#333", letterSpacing: 0.5 },
  integratedCouponDate: { fontSize: 11, color: "#777", marginTop: 2 },
  couponHint: { fontSize: 12, color: "#666", fontStyle: "italic", marginTop: 12, textAlign: "center" },
  ball: { position: "absolute", width: BALL_SIZE, height: BALL_SIZE, borderRadius: BALL_RADIUS, backgroundColor: "rgba(46, 125, 50, 0.5)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.6)", elevation: 0, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  ballHighlight: { position: 'absolute', top: 6, left: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.7)' },
  tutorialOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.75)", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  tutorialCard: { backgroundColor: "#fff", width: SCREEN_WIDTH * 0.85, padding: 24, borderRadius: 24, elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 },
  tutorialTitle: { fontSize: 24, fontWeight: "bold", color: "#2E7D32", marginBottom: 12 },
  tutorialContent: { fontSize: 16, color: "#444", lineHeight: 24, marginBottom: 28 },
  tutorialFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  skipText: { color: "#666", fontSize: 16, fontWeight: "500" },
  nextButton: { backgroundColor: "#2E7D32", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  nextButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
