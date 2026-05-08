import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const Particle = ({ delay }: { delay: number }) => {
  const moveAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const startX = Math.random() * width;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(moveAnim, {
            toValue: -height - 100,
            duration: 4000 + Math.random() * 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0.6,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 3000,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: startX,
          bottom: -50,
          opacity: opacityAnim,
          transform: [{ translateY: moveAnim }, { scale: 0.5 + Math.random() }],
        },
      ]}
    >
      <Text style={{ fontSize: 20 }}>🍃</Text>
    </Animated.View>
  );
};

export const SplashScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const textSlideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Initial Entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 10,
        useNativeDriver: true,
      }),
      Animated.timing(textSlideAnim, {
        toValue: 0,
        duration: 1000,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse Logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 4500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#0288D1']} // Forest Green to Sky Blue
        style={styles.background}
      />
      
      {/* Background Particles */}
      {[...Array(12)].map((_, i) => (
        <Particle key={i} delay={i * 400} />
      ))}

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.logoEmoji}>🚆🍃</Text>
        </Animated.View>
        
        <Animated.View style={{ transform: [{ translateY: textSlideAnim }] }}>
          <Text style={styles.title}>JAGRUT</Text>
          <Text style={styles.subtitle}>Tracking a Greener Future</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fadeAnim, transform: [{ translateY: textSlideAnim }] }]}>
        <View style={styles.shimmerContainer}>
          <Text style={styles.footerText}>Small Steps, Clean Planet</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: 'absolute',
    zIndex: 1,
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoContainer: {
    width: 140,
    height: 140,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  logoEmoji: {
    fontSize: 70,
  },
  title: {
    fontSize: 52,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    fontWeight: '600',
    letterSpacing: 3,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 2,
    fontWeight: '500',
  },
  shimmerContainer: {
    overflow: 'hidden',
  }
});
