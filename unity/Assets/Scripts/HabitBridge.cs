using UnityEngine;

namespace EverWorld
{
    // Entry point for state pushed in from the React Native shell via
    // Unity as a Library. The native host calls
    // UnitySendMessage("HabitBridge", "ApplyWorldState", jsonString)
    // whenever the app recomputes world state (after a habit log, on
    // app open, etc). This object should live on a GameObject named
    // exactly "HabitBridge" so UnitySendMessage can find it.
    public class HabitBridge : MonoBehaviour
    {
        [SerializeField] private WorldGrowthEngine worldGrowthEngine;
        [SerializeField] private AnimalSpawnEngine animalSpawnEngine;
        [SerializeField] private WeatherController weatherController;

        private WorldState _currentState;

        // Called by the native RN host. Keep this method signature stable —
        // it's the entire public contract with the app shell.
        public void ApplyWorldState(string json)
        {
            WorldState state;
            try
            {
                state = JsonUtility.FromJson<WorldState>(json);
            }
            catch (System.Exception e)
            {
                Debug.LogError($"HabitBridge: failed to parse world state JSON: {e.Message}");
                return;
            }

            _currentState = state;
            worldGrowthEngine.Apply(state);
            animalSpawnEngine.Apply(state);
            weatherController.Apply(state);
        }

        public WorldState CurrentState => _currentState;
    }
}
