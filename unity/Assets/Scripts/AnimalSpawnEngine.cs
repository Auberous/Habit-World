using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;

namespace EverWorld
{
    // Spawns/despawns animals to match WorldState.spawnedAnimals, and gives
    // each a minimal wander behaviour via NavMesh. Spawn/despawn *decisions*
    // come entirely from the habit engine (JS) via WorldState — this script
    // only ever reconciles the scene to match that list, it never decides
    // spawn conditions itself.
    public class AnimalSpawnEngine : MonoBehaviour
    {
        [System.Serializable]
        public class AnimalPrefabEntry
        {
            public string animalId; // matches animals.json's animals[].id
            public GameObject prefab;
        }

        [SerializeField] private AnimalPrefabEntry[] animalPrefabs;
        [SerializeField] private Transform spawnRoot;
        [SerializeField] private float wanderRadius = 15f;

        private readonly Dictionary<string, GameObject> _active = new();

        public void Apply(WorldState state)
        {
            var desired = new HashSet<string>(state.spawnedAnimals);

            // Despawn anything no longer in the list.
            var toRemove = new List<string>();
            foreach (var kv in _active)
            {
                if (!desired.Contains(kv.Key))
                {
                    Destroy(kv.Value);
                    toRemove.Add(kv.Key);
                }
            }
            foreach (var id in toRemove) _active.Remove(id);

            // Spawn anything newly unlocked.
            foreach (var id in desired)
            {
                if (_active.ContainsKey(id)) continue;
                var entry = System.Array.Find(animalPrefabs, e => e.animalId == id);
                if (entry?.prefab == null)
                {
                    Debug.LogWarning($"AnimalSpawnEngine: no prefab registered for '{id}'");
                    continue;
                }
                var go = Instantiate(entry.prefab, spawnRoot.position, Quaternion.identity, spawnRoot);
                var wander = go.GetComponent<WanderBehaviour>() ?? go.AddComponent<WanderBehaviour>();
                wander.radius = wanderRadius;
                _active[id] = go;
            }
        }
    }

    // Minimal NavMesh wander AI — enough to make spawned animals feel alive
    // without a full behaviour tree. Swap for a proper behaviour-tree asset
    // (e.g. NodeCanvas, Behavior Designer) once per-species behaviours
    // (flee, soar, prowl, ...) need to diverge meaningfully.
    [RequireComponent(typeof(NavMeshAgent))]
    public class WanderBehaviour : MonoBehaviour
    {
        public float radius = 15f;
        public float retargetInterval = 4f;

        private NavMeshAgent _agent;
        private float _timer;

        private void Awake() => _agent = GetComponent<NavMeshAgent>();

        private void Update()
        {
            _timer -= Time.deltaTime;
            if (_timer > 0f) return;
            _timer = retargetInterval + Random.Range(-1f, 1f);

            Vector2 offset = Random.insideUnitCircle * radius;
            Vector3 target = transform.position + new Vector3(offset.x, 0, offset.y);
            if (NavMesh.SamplePosition(target, out var hit, radius, NavMesh.AllAreas))
            {
                _agent.SetDestination(hit.position);
            }
        }
    }
}
