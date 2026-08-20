using System.Collections.Generic;
using UnityEngine;

namespace EverWorld
{
    // Toggles/blends weather VFX to match WorldState.activeWeather.
    // Multiple patterns can be active simultaneously (per weather.json's
    // notes), so this enables/disables a set rather than switching between
    // exclusive states.
    public class WeatherController : MonoBehaviour
    {
        [System.Serializable]
        public class WeatherEffectEntry
        {
            public string weatherId; // matches weather.json's patterns[].id
            public GameObject effectRoot; // particle system / volume / etc, toggled active
            [Range(0f, 5f)] public float fadeSeconds = 1.5f;
        }

        [SerializeField] private WeatherEffectEntry[] effects;

        private readonly HashSet<string> _active = new();

        public void Apply(WorldState state)
        {
            var desired = new HashSet<string>(state.activeWeather);

            foreach (var entry in effects)
            {
                bool shouldBeActive = desired.Contains(entry.weatherId);
                bool isActive = _active.Contains(entry.weatherId);
                if (shouldBeActive == isActive) continue;

                if (shouldBeActive)
                {
                    entry.effectRoot.SetActive(true);
                    _active.Add(entry.weatherId);
                    // TODO: crossfade in over entry.fadeSeconds (e.g. via a
                    // CanvasGroup/ParticleSystem emission-rate tween) rather
                    // than a hard cut, once the specific VFX assets exist.
                }
                else
                {
                    _active.Remove(entry.weatherId);
                    entry.effectRoot.SetActive(false);
                }
            }
        }
    }
}
