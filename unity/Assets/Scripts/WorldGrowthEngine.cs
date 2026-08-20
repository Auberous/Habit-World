using UnityEngine;

namespace EverWorld
{
    // Procedurally places terrain/foliage based on color levels. Deliberately
    // simple and data-driven: this should never hardcode "if green >= 3
    // spawn a specific hand-placed tree" logic beyond what's expressed in
    // biomes.json — new content should be addable by editing config plus
    // dropping in a prefab, not by touching this script.
    public class WorldGrowthEngine : MonoBehaviour
    {
        [System.Serializable]
        public class FoliagePrefabEntry
        {
            public string unlockId; // matches an entry in a color's "unlocks" array in habits.json
            public GameObject prefab;
            [Range(0, 50)] public int maxInstances = 12;
        }

        [SerializeField] private FoliagePrefabEntry[] foliagePrefabs;
        [SerializeField] private Transform plantRoot;
        [SerializeField] private Terrain terrain;

        private readonly System.Collections.Generic.List<GameObject> _spawned = new();

        public void Apply(WorldState state)
        {
            ClearPrevious();

            foreach (var entry in foliagePrefabs)
            {
                float density = DensityFor(entry.unlockId, state);
                int count = Mathf.RoundToInt(density * entry.maxInstances);
                for (int i = 0; i < count; i++)
                {
                    Vector3 pos = RandomPointOnTerrain();
                    var go = Instantiate(entry.prefab, pos, Quaternion.Euler(0, Random.Range(0, 360), 0), plantRoot);
                    _spawned.Add(go);
                }
            }
        }

        // Maps an "unlock id" (e.g. "trees", "flowers") back to whichever
        // color governs it and returns a 0..1 density based on that color's
        // level. This lookup is O(colors) and small, so no need to cache.
        private float DensityFor(string unlockId, WorldState state)
        {
            // In the full implementation this reads habits.json's
            // colors[].unlocks to find which color owns `unlockId`, then
            // normalizes WorldStateLookup.LevelOf(state, colorId) against
            // maxLevelPerColor. Left as a TODO wire-up once the JSON config
            // loader (Resources/StreamingAssets read) is in place, so this
            // stays a pure function of config + state rather than a
            // hardcoded switch statement.
            return 0f;
        }

        private void ClearPrevious()
        {
            foreach (var go in _spawned) Destroy(go);
            _spawned.Clear();
        }

        private Vector3 RandomPointOnTerrain()
        {
            if (terrain == null) return Vector3.zero;
            var td = terrain.terrainData;
            float x = Random.Range(0, td.size.x);
            float z = Random.Range(0, td.size.z);
            float y = terrain.SampleHeight(new Vector3(x, 0, z) + terrain.transform.position);
            return new Vector3(x, y, z) + terrain.transform.position;
        }
    }
}
