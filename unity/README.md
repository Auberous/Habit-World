# EverWorld — Unity Renderer

This is the Unity side of EverWorld: it owns the world, terrain, animals,
weather, camera and animation — everything visual. It knows nothing about
habit logic; it only ever reads a `WorldState` JSON payload (same shape
`src/engine/habitEngine.js` produces) and renders whatever it says.

**This project can't be built or previewed in this sandbox** — there's no
Unity Editor here, so nothing under `Assets/Scripts` has been compiled or
run. Open this folder as a Unity project (2022 LTS or newer, URP template)
on your own machine to actually build and test it. Treat the C# below as a
correct-by-review starting point, not verified-working code.

## Structure

```
unity/
  Assets/
    Scripts/
      WorldState.cs           // C# mirror of the JSON contract
      HabitBridge.cs           // receives world state from the app shell
      WorldGrowthEngine.cs      // places terrain/foliage from color levels
      AnimalSpawnEngine.cs      // spawns/despawns animals, simple wander AI
      WeatherController.cs      // toggles/blends weather VFX
      CameraController.cs       // high-oblique RTS-style camera rig
    StreamingAssets/
      habits.json, biomes.json, animals.json, weather.json
      (copied from /shared/config — see note below)
```

## Integration model: Unity as a Library

The React Native app embeds this Unity project as a **Unity as a Library**
module (Unity's official RN/native embedding path — see
`docs.unity3d.com/Manual/UnityasaLibrary.html`). Rough flow:

1. RN computes `WorldState` via `src/engine/habitEngine.js` (the same JS
   the web prototype could reuse) and serializes it to JSON.
2. RN sends that JSON string to Unity via `UnityFramework`/`UnityPlayer`'s
   native messaging bridge (`UnitySendMessage` on the native side, wrapped
   by the `react-native-unity-view`-style library you choose).
3. `HabitBridge.cs` receives the string, deserializes into `WorldState`,
   and calls into `WorldGrowthEngine`, `AnimalSpawnEngine`, and
   `WeatherController` to update the live scene.
4. Unity never calls back into JS for game logic — it's a pure renderer of
   whatever state it was handed. This keeps the "one source of truth"
   property the JSON configs are designed around.

## Keeping configs in sync

`shared/config/*.json` is the canonical copy. Unity reads its own copy from
`Assets/StreamingAssets` because Unity can't read arbitrary paths outside
the project at runtime on device. Until there's a build step to automate
the copy, keep them manually in sync — same content, two locations.
