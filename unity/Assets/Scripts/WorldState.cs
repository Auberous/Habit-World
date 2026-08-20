using System;
using System.Collections.Generic;

namespace EverWorld
{
    // C# mirror of the JSON payload produced by src/engine/habitEngine.js's
    // computeWorldState(). Field names match exactly so JsonUtility (or a
    // Newtonsoft fallback if nested dictionaries need richer support) can
    // deserialize the RN payload with no translation layer.
    [Serializable]
    public class WorldState
    {
        public ColorLevel[] colorLevels;   // flattened from JS's {green: 2.4, ...} — see note below
        public string[] unlockedBiomes;
        public string[] spawnedAnimals;
        public string[] activeWeather;
        public string generatedAt;
    }

    [Serializable]
    public class ColorLevel
    {
        public string color; // "green" | "blue" | "brown" | "yellow" | "purple" | "red"
        public float level;  // 0..maxLevelPerColor
    }

    // JsonUtility can't deserialize a JS object-as-map directly, so the RN
    // side should flatten colorLevels into this array shape before sending
    // (or swap JsonUtility for Newtonsoft.Json here if you'd rather keep
    // the JS side untouched — either is a small, isolated change).
    public static class WorldStateLookup
    {
        public static float LevelOf(WorldState state, string colorId)
        {
            foreach (var c in state.colorLevels)
            {
                if (c.color == colorId) return c.level;
            }
            return 0f;
        }

        public static bool Has(string[] items, string id)
        {
            return Array.IndexOf(items, id) >= 0;
        }
    }
}
