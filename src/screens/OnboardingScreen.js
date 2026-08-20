import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function OnboardingScreen({ onContinue }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>EverWorld</Text>
      <Text style={styles.body}>
        EverWorld is a living landscape that grows as you grow. Every habit
        you improve brings new life, colour, weather, and creatures into
        your world.
      </Text>
      <Pressable style={styles.button} onPress={onContinue}>
        <Text style={styles.buttonText}>Begin</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1c2534', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 34, color: '#fff', fontWeight: '600', marginBottom: 20 },
  body: { fontSize: 15, color: '#c9d3e0', textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  button: { backgroundColor: '#8fd0ee', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30 },
  buttonText: { color: '#1c2534', fontWeight: '700', fontSize: 16 },
});
