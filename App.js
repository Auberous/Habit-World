import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useEffect, useRef } from 'react';

export default function App() {
  // Fog animations
  const fog1 = useRef(new Animated.Value(0)).current;
  const fog2 = useRef(new Animated.Value(0)).current;
  const fog3 = useRef(new Animated.Value(0)).current;

  // Cloud animations
  const cloud1 = useRef(new Animated.Value(0)).current;
  const cloud2 = useRef(new Animated.Value(0)).current;
  const cloud3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopFog = (anim, duration) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false
          })
        ])
      ).start();
    };

    const loopCloud = (anim, duration) => {
      Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: false
        })
      ).start();
    };

    // Fog speeds
    loopFog(fog1, 9000);
    loopFog(fog2, 12000);
    loopFog(fog3, 15000);

    // Slow cloud drift
    loopCloud(cloud1, 30000);
    loopCloud(cloud2, 36000);
    loopCloud(cloud3, 42000);
  }, [fog1, fog2, fog3, cloud1, cloud2, cloud3]);

  const fogCurve = (anim, xRange, yRange) => ({
    transform: [
      {
        translateX: anim.interpolate({
          inputRange: [0, 1],
          outputRange: xRange
        })
      },
      {
        translateY: anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [yRange[0], yRange[1], yRange[0]]
        })
      }
    ]
  });

  const cloudDrift = anim => ({
    transform: [
      {
        translateX: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-80, 80]
        })
      }
    ]
  });

  return (
    <View style={styles.container}>
      {/* Dramatic moody sky */}
      <View style={styles.sky}>
        <View style={styles.skyGradientTop} />
        <View style={styles.skyGradientBottom} />
      </View>

      {/* Horizon band */}
      <View style={styles.horizon} />

      {/* Dusty plains */}
      <View style={styles.ground}>
        <View style={styles.dustPatch1} />
        <View style={styles.dustPatch2} />
        <View style={styles.crack1} />
        <View style={styles.crack2} />
        <View style={styles.stone1} />
        <View style={styles.stone2} />
      </View>

      {/* Clouds */}
      <Animated.View style={[styles.cloudPatch1, cloudDrift(cloud1)]} />
      <Animated.View style={[styles.cloudPatch2, cloudDrift(cloud2)]} />
      <Animated.View style={[styles.cloudPatch3, cloudDrift(cloud3)]} />

      {/* Fog wisps */}
      <Animated.View style={[styles.fog1, fogCurve(fog1, [-60, 60], [-10, 15])]} />
      <Animated.View style={[styles.fog2, fogCurve(fog2, [-40, 40], [-20, 10])]} />
      <Animated.View style={[styles.fog3, fogCurve(fog3, [-30, 30], [-5, 20])]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2f2f2f' },

  // Dramatic sky
  sky: { flex: 2 },
  skyGradientTop: { flex: 1, backgroundColor: '#3a3a3a' },
  skyGradientBottom: { flex: 1, backgroundColor: '#4d4d4d' },

  // Horizon band
  horizon: { height: 20, backgroundColor: '#5c5c5c' },

  // Dusty plains
  ground: {
    flex: 1,
    backgroundColor: '#6b6b6b',
    alignItems: 'center'
  },

  // Dust patches
  dustPatch1: {
    position: 'absolute',
    bottom: 40,
    width: 220,
    height: 60,
    backgroundColor: '#7a7a7a',
    opacity: 0.25,
    borderRadius: 30
  },
  dustPatch2: {
    position: 'absolute',
    bottom: 10,
    width: 260,
    height: 50,
    backgroundColor: '#808080',
    opacity: 0.2,
    borderRadius: 25
  },

  // Cracks
  crack1: {
    position: 'absolute',
    bottom: 70,
    width: 140,
    height: 6,
    backgroundColor: '#4a4a4a',
    borderRadius: 3,
    opacity: 0.4
  },
  crack2: {
    position: 'absolute',
    bottom: 30,
    width: 180,
    height: 5,
    backgroundColor: '#4f4f4f',
    borderRadius: 3,
    opacity: 0.35
  },

  // Stones
  stone1: {
    position: 'absolute',
    bottom: 55,
    width: 30,
    height: 20,
    backgroundColor: '#5a5a5a',
    borderRadius: 10,
    opacity: 0.5
  },
  stone2: {
    position: 'absolute',
    bottom: 20,
    width: 40,
    height: 25,
    backgroundColor: '#555',
    borderRadius: 12,
    opacity: 0.45
  },

  // Clouds
  cloudPatch1: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 40
  },
  cloudPatch2: {
    position: 'absolute',
    top: 110,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 50
  },
  cloudPatch3: {
    position: 'absolute',
    top: 160,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 35
  },

  // Fog
  fog1: {
    position: 'absolute',
    top: 200,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 70
  },
  fog2: {
    position: 'absolute',
    top: 260,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 80
  },
  fog3: {
    position: 'absolute',
    top: 310,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 60
  }
});
