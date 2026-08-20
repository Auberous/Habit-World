import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import habitsConfig from '../../shared/config/habits.json';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyTrackerScreen({ habits, logs, onLog, onViewWorld }) {
  const today = todayIso();
  const loggedToday = new Set(logs.filter((l) => l.date === today).map((l) => l.habitId));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's habits</Text>
      <ScrollView style={styles.list}>
        {habits.map((habit) => {
          const color = habitsConfig.colors.find((c) => c.id === habit.colorId);
          const done = loggedToday.has(habit.id);
          return (
            <Pressable
              key={habit.id}
              style={[styles.card, done && styles.cardDone]}
              disabled={done}
              onPress={() => onLog(habit.id, today)}
            >
              <View style={[styles.swatch, { backgroundColor: color.hex }]} />
              <Text style={styles.cardTitle}>{habit.name}</Text>
              <Text style={styles.cardStatus}>{done ? 'Logged' : 'Tap to log'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable style={styles.button} onPress={onViewWorld}>
        <Text style={styles.buttonText}>View your world</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1c2534', padding: 24, paddingTop: 60 },
  title: { fontSize: 24, color: '#fff', fontWeight: '700', marginBottom: 20 },
  list: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardDone: { opacity: 0.5 },
  swatch: { width: 18, height: 18, borderRadius: 9, marginRight: 12 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  cardStatus: { color: '#8fa0ba', fontSize: 12 },
  button: { backgroundColor: '#8fd0ee', paddingVertical: 14, borderRadius: 30, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#1c2534', fontWeight: '700', fontSize: 15 },
});
