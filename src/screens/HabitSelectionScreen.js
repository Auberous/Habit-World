import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import habitsConfig from '../../shared/config/habits.json';

// Lets the user pick 1-6 habits and assign each to one of the six color
// domains. Kept intentionally simple (one habit per color, tap to toggle)
// for v1 — multiple habits sharing a color is a natural extension once the
// habit engine's per-color aggregation (see computeColorLevels) is tested
// against that case.
export default function HabitSelectionScreen({ onContinue }) {
  const [selected, setSelected] = useState({}); // { [colorId]: habitName }

  function setHabitName(colorId, name) {
    setSelected((prev) => ({ ...prev, [colorId]: name }));
  }

  function toggleColor(colorId) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[colorId] != null) delete next[colorId];
      else next[colorId] = habitsConfig.colors.find((c) => c.id === colorId).name;
      return next;
    });
  }

  const chosenCount = Object.keys(selected).length;

  function handleContinue() {
    const habits = Object.entries(selected).map(([colorId, name], i) => ({
      id: `habit_${colorId}`,
      name,
      colorId,
    }));
    onContinue(habits);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose 1-6 habits</Text>
      <Text style={styles.subtitle}>What matters most to you right now?</Text>
      <ScrollView style={styles.list}>
        {habitsConfig.colors.map((c) => {
          const isSelected = selected[c.id] != null;
          return (
            <Pressable
              key={c.id}
              style={[styles.card, isSelected && { borderColor: c.hex, borderWidth: 2 }]}
              onPress={() => toggleColor(c.id)}
            >
              <View style={[styles.swatch, { backgroundColor: c.hex }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{c.name}</Text>
                <Text style={styles.cardDomain}>{c.domain}</Text>
              </View>
              <Text style={styles.check}>{isSelected ? '✓' : ''}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable
        style={[styles.button, chosenCount === 0 && styles.buttonDisabled]}
        disabled={chosenCount === 0}
        onPress={handleContinue}
      >
        <Text style={styles.buttonText}>Continue ({chosenCount} selected)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1c2534', padding: 24, paddingTop: 60 },
  title: { fontSize: 24, color: '#fff', fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#8fa0ba', marginBottom: 20 },
  list: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatch: { width: 22, height: 22, borderRadius: 11, marginRight: 12 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardDomain: { color: '#8fa0ba', fontSize: 12, marginTop: 2 },
  check: { color: '#8fd0ee', fontSize: 18, fontWeight: '700' },
  button: { backgroundColor: '#8fd0ee', paddingVertical: 14, borderRadius: 30, alignItems: 'center', marginTop: 12 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#1c2534', fontWeight: '700', fontSize: 15 },
});
