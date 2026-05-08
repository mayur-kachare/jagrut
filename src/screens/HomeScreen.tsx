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
  "Your commute is carbon-lite and planet-bright. Great job! 🌈",
  "Every kilometer on the metro is a kilometer for a healthier Earth. 🛣️",
  "You're reducing urban congestion and carbon emissions. Double win! 🚦",
  "Your green steps today are paving the way for a blue sky tomorrow. ☁️",
  "Choosing the metro is a direct vote for a sustainable future. 🗳️",
  "Keep the momentum going! Your environmental impact is inspiring. 🚀",
  "One less car on the road means more space for nature. 🌿",
  "Your CO2 savings are stacking up. You're building a greener legacy! 🧱",
  "Pure air starts with pure choices. Thank you for choosing green! 💎",
  "Every ride counts. Every gram matters. You matter. 💖",
  "Be the change you want to see. Your commute is the perfect start. 🕯️",
  "Green travel is a habit that keeps the planet healthy. 🍎",
  "Your conscious choices are the seeds of a sustainable world. 🌻",
  "Save CO2, earn rewards, and help the Earth. It's that simple! 🍭",
  "Together, we can cool down the planet. One ride at a time. ❄️",
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

const OBSTACLES = [
  { id: 'car', icon: '🚗', relX: -85, relY: -60, size: 32 },
  { id: 'bike', icon: '🏍️', relX: 85, relY: -60, size: 32 },
  { id: 'suv', icon: '🚙', relX: 0, relY: 65, size: 32 },
];

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
      vx.current = vx.current * 0.8 + (-x) * 1.6;
      vy.current = vy.current * 0.8 + y * 1.6;
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

      if (px.current < minX) { px.current = minX; vx.current = Math.abs(vx.current) * 0.5; }
      if (px.current > maxX) { px.current = maxX; vx.current = -Math.abs(vx.current) * 0.5; }
      if (py.current < minY) { py.current = minY; vy.current = Math.abs(vy.current) * 0.5; }
      if (py.current > maxY) { py.current = maxY; vy.current = -Math.abs(vy.current) * 0.5; }

      vx.current *= 0.965;
      vy.current *= 0.965;

      ballXY.setValue({ x: px.current - BALL_RADIUS, y: py.current - BALL_RADIUS });

      const bw = buttonLayout.current.width;
      const bh = buttonLayout.current.height;
      if (!triggered.current && bw > 0 && bh > 0) {
        const bx = buttonLayout.current.x + bw / 2;
        const by = headerHeight.current + cameraContainerY.current + buttonLayout.current.y + bh / 2 - scrollOffset.current;
        
        const dx = px.current - bx;
        const dy = py.current - by;
        const dist = Math.hypot(dx, dy);
        
        // Obstacle collision detection
        OBSTACLES.forEach((obs) => {
          const obsX = bx + obs.relX;
          const obsY = by + obs.relY;
          const obsDx = px.current - obsX;
          const obsDy = py.current - obsY;
          const obsDist = Math.hypot(obsDx, obsDy);
          
          if (obsDist < (BALL_RADIUS + obs.size / 2)) {
            // Collision! Simple bounce back
            const bounceAngle = Math.atan2(obsDy, obsDx);
            vx.current = Math.cos(bounceAngle) * 4;
            vy.current = Math.sin(bounceAngle) * 4;
            px.current = obsX + Math.cos(bounceAngle) * (BALL_RADIUS + obs.size / 2 + 1);
            py.current = obsY + Math.sin(bounceAngle) * (BALL_RADIUS + obs.size / 2 + 1);
          }
        });

        // Magnetic pull only when very close to center
        if (dist < 40) {
          vx.current -= dx * 0.08;
          vy.current -= dy * 0.08;
        }

        if (dist < 25) { // Smaller trigger radius
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

        <View style={styles.trainWrapper}>
          <View style={styles.trainContainer}>
            {/* Compartment 2 - Bills */}
            <View style={styles.trainCompartment}>
              <View style={styles.compartmentTop} />
              <View style={styles.windowRow}>
                <View style={styles.smallWindow} />
                <View style={styles.smallWindow} />
              </View>
              <View style={styles.stripeContainer}>
                <View style={styles.trainStripe} />
              </View>
              <Text style={styles.trainValue}>{stats?.billCount || 0}</Text>
              <Text style={styles.trainLabel}>Bills</Text>
            </View>

            <View style={styles.trainConnector} />

            {/* Compartment 1 - Expenses */}
            <View style={styles.trainCompartment}>
              <View style={styles.compartmentTop} />
              <View style={styles.windowRow}>
                <View style={styles.smallWindow} />
                <View style={styles.smallWindow} />
              </View>
              <View style={styles.stripeContainer}>
                <View style={styles.trainStripe} />
              </View>
              <Text style={styles.trainValue}>₹{(stats?.totalExpenses || 0).toFixed(0)}</Text>
              <Text style={styles.trainLabel}>Expenses</Text>
            </View>

            <View style={styles.trainConnector} />

            {/* Engine - Front (Right) */}
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
              <View style={styles.engineTop} />
              <View style={styles.engineCab}>
                <View style={styles.engineWindow} />
              </View>
              <View style={styles.stripeContainer}>
                <View style={styles.trainStripe} />
              </View>
              <Text style={styles.trainValue}>{stats?.totalCo2Saved?.toFixed(1) || "0"} g</Text>
              <Text style={[styles.trainLabel, { fontSize: 8 }]}>CO2 Saved</Text>
              <View style={styles.engineHeadlight} />
            </TouchableOpacity>
          </View>
          <View style={styles.trainTrackContainer}>
            <View style={styles.sleeperContainer}>
              {[...Array(12)].map((_, i) => (
                <View key={i} style={styles.sleeper} />
              ))}
            </View>
            <View style={styles.railLine} />
            <View style={[styles.railLine, { marginTop: 4 }]} />
          </View>
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

          {/* Static Obstacles */}
          {OBSTACLES.map((obs) => (
            <View 
              key={obs.id}
              style={[
                styles.obstacle, 
                { 
                  transform: [
                    { translateX: obs.relX },
                    { translateY: obs.relY }
                  ]
                }
              ]}
            >
              <Text style={{ fontSize: obs.size - 6 }}>{obs.icon}</Text>
            </View>
          ))}
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
  trainWrapper: { marginHorizontal: 0, marginBottom: 20, marginTop: 25, alignItems: 'center', width: '100%' },
  trainContainer: { flexDirection: "row", alignItems: "flex-end", height: 75, paddingBottom: 5, width: '100%', justifyContent: 'center' },
  trainCompartment: { width: 75, height: 62, backgroundColor: "#B2DFDB", borderRadius: 6, justifyContent: "center", alignItems: "center", position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#80CBC4', elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  trainEngine: { width: 75, height: 62, borderTopRightRadius: 35, borderBottomRightRadius: 8, backgroundColor: "#E0F2F1", borderColor: '#4DB6AC', borderTopWidth: 2, borderRightWidth: 2, borderLeftWidth: 1 },
  engineTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 22, backgroundColor: '#FFF59D', borderTopRightRadius: 35 },
  compartmentTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 12, backgroundColor: '#E0F2F1' },
  engineCab: { position: 'absolute', top: 4, right: 6, width: 40, height: 28, backgroundColor: '#81D4FA', borderTopRightRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: '#4FC3F7' },
  engineWindow: { flex: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  windowRow: { flexDirection: 'row', position: 'absolute', top: 15, width: '100%', justifyContent: 'space-around', paddingHorizontal: 5 },
  smallWindow: { width: 22, height: 18, backgroundColor: '#81D4FA', borderRadius: 3, borderWidth: 1, borderColor: '#4FC3F7' },
  stripeContainer: { position: 'absolute', bottom: 20, width: '100%', height: 6, justifyContent: 'center' },
  trainStripe: { height: 4, backgroundColor: '#F8BBD0', width: '100%' },
  trainConnector: { width: 8, height: 3, backgroundColor: "#546E7A", alignSelf: "flex-end", marginBottom: 12 },
  trainValue: { fontSize: normalize(11), fontWeight: "900", color: "#004D40", zIndex: 5, marginTop: 12 },
  trainLabel: { fontSize: 7, color: "#00695C", fontWeight: "800", zIndex: 5, textTransform: 'uppercase' },
  engineHeadlight: { position: 'absolute', bottom: 6, right: 5, width: 6, height: 6, backgroundColor: '#FFD54F', borderRadius: 3, borderWidth: 1, borderColor: '#FBC02D', elevation: 4 },
  trainTrackContainer: { width: 250, height: 15, marginTop: -5, alignItems: 'flex-start', justifyContent: 'center' },
  railLine: { width: '100%', height: 2, backgroundColor: '#455A64', borderRadius: 1 },
  sleeperContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 5 },
  sleeper: { width: 15, height: 3, backgroundColor: '#78909C' },
  cameraContainer: { paddingVertical: 24, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  leafButton: { width: 140, height: 100, borderTopLeftRadius: 70, borderBottomRightRadius: 70, borderTopRightRadius: 20, borderBottomLeftRadius: 20, backgroundColor: "#2E7D32", justifyContent: "center", alignItems: "center", elevation: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, gap: 4, overflow: 'hidden' },
  cameraIcon: { fontSize: 28 },
  cameraLabel: { fontSize: 13, color: "#fff", fontWeight: "bold", textAlign: "center", paddingHorizontal: 10 },
  leafSubMessage: { fontSize: 8, color: "rgba(255, 255, 255, 0.8)", fontWeight: "600", textTransform: "uppercase", marginTop: -2 },
  obstacle: { position: 'absolute', width: 32, height: 32, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', zIndex: -1 },
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
