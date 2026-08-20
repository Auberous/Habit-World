import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { useEffect, useRef } from 'react';

// Placeholder world renderer. The real terrain/animals/weather rendering is
// Unity's job (see /unity) once it's embedded via Unity as a Library; until
// that embed exists, this reuses the fog/cloud background from the original
// prototype and overlays the computed world state as simple badges, so the
// full data flow (habit log -> engine -> "world") is visible and testable
// end-to-end today, even without real 3D rendering.
export default function WorldViewScreen({ worldState, onBack }) {
  const fog1 = useRef(new Animated.Value(0)).current;
  const cloud1 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fog1, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(fog1, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(cloud1, { toValue: 1, duration: 30000, easing: Easing.linear, useNativeDriver: false })
    ).start();
  }, [fog1, cloud1]);

  const fogStyle = {
    transform: [
      { translateX: fog1.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] }) },
      { translateY: fog1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-10, 15, -10] }) },
    ],
  };
  const cloudStyle = {
    transform: [{ translateX: cloud1.interpolate({ inputRange: [0, 1], outputRange: [-80, 80] }) }],
  };

  return (
    <View style={styles.container}>
      <View style={styles.sky} />
      <View style={styles.horizon} />
      <View style={styles.ground} />
      <Animated.View style={[styles.cloud, cloudStyle]} />
      <Animated.View style={[styles.fog, fogStyle]} />

      <View style={styles.overlay}>
        <Text style={styles.overlayHeading}>Unlocked biomes</Text>
        <Text style={styles.overlayText}>
          {worldState.unlockedBiomes.length ? worldState.unlockedBiomes.join(', ') : 'none yet'}
        </Text>
        <Text style={styles.overlayHeading}>Creatures nearby</Text>
        <Text style={styles.overlayText}>
          {worldState.spawnedAnimals.length ? worldState.spawnedAnimals.join(', ') : 'none yet'}
        </Text>
        <Text style={styles.overlayHeading}>Weather</Text>
        <Text style={styles.overlayText}>{worldState.activeWeather.join(', ')}</Text>
      </View>

      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2f2f2f' },
  sky: { flex: 2, backgroundColor: '#3a4a5a' },
  horizon: { height: 20, backgroundColor: '#5c6c7c' },
  ground: { flex: 1, backgroundColor: '#4a5a3a' },
  cloud: { position: 'absolute', top: 60, left: 0, right: 0, height: 80, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 40 },
  fog: { position: 'absolute', top: 200, left: 0, right: 0, height: 140, backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 70 },
  overlay: { position: 'absolute', top: 50, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 12, padding: 14 },
  overlayHeading: { color: '#8fd0ee', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  overlayText: { color: '#fff', fontSize: 13, marginTop: 2 },
  backButton: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 24 },
  backText: { color: '#fff', fontWeight: '600' },
});
