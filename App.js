import { useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';

import OnboardingScreen from './src/screens/OnboardingScreen';
import HabitSelectionScreen from './src/screens/HabitSelectionScreen';
import DailyTrackerScreen from './src/screens/DailyTrackerScreen';
import WorldViewScreen from './src/screens/WorldViewScreen';

import { computeWorldState } from './src/engine/habitEngine';
import habitsConfig from './shared/config/habits.json';
import biomesConfig from './shared/config/biomes.json';
import animalsConfig from './shared/config/animals.json';
import weatherConfig from './shared/config/weather.json';

// No navigation library yet — a plain screen-name state machine keeps this
// runnable with today's dependencies (see package.json). Swap for
// react-navigation once the flow needs deep linking, native transitions,
// or a tab bar; the screens themselves don't assume anything about how
// they're mounted.
const SCREENS = { ONBOARDING: 'onboarding', HABITS: 'habits', TRACKER: 'tracker', WORLD: 'world' };

export default function App() {
  const [screen, setScreen] = useState(SCREENS.ONBOARDING);
  const [habits, setHabits] = useState([]);
  const [logs, setLogs] = useState([]);

  const worldState = useMemo(
    () =>
      computeWorldState({
        habits,
        logs,
        config: { habits: habitsConfig, biomes: biomesConfig, animals: animalsConfig, weather: weatherConfig },
        today: new Date().toISOString().slice(0, 10),
      }),
    [habits, logs]
  );

  function handleHabitsChosen(chosenHabits) {
    setHabits(chosenHabits);
    setScreen(SCREENS.TRACKER);
  }

  function handleLog(habitId, date) {
    setLogs((prev) => [...prev, { habitId, date }]);
  }

  return (
    <>
      <StatusBar style="light" />
      {screen === SCREENS.ONBOARDING && (
        <OnboardingScreen onContinue={() => setScreen(SCREENS.HABITS)} />
      )}
      {screen === SCREENS.HABITS && <HabitSelectionScreen onContinue={handleHabitsChosen} />}
      {screen === SCREENS.TRACKER && (
        <DailyTrackerScreen
          habits={habits}
          logs={logs}
          onLog={handleLog}
          onViewWorld={() => setScreen(SCREENS.WORLD)}
        />
      )}
      {screen === SCREENS.WORLD && (
        <WorldViewScreen worldState={worldState} onBack={() => setScreen(SCREENS.TRACKER)} />
      )}
    </>
  );
}
