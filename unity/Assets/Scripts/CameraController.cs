using UnityEngine;

namespace EverWorld
{
    // High-oblique RTS-style camera: fixed pitch looking down and out
    // across the land with the horizon and sky visible (per the spec's
    // "standing on a mountain looking down at your world" framing), rather
    // than a top-down strategy-game camera. Supports a gentle wake-up pan
    // on app open and gesture-driven orbit/zoom for the player.
    public class CameraController : MonoBehaviour
    {
        [SerializeField] private Transform worldCenter;
        [SerializeField] private float distance = 30f;
        [SerializeField] private float pitchDegrees = 35f; // high oblique, not top-down (90)
        [SerializeField] private float wakeUpPanSeconds = 2.5f;
        [SerializeField] private AnimationCurve wakeUpEase = AnimationCurve.EaseInOut(0, 0, 1, 1);

        private float _yaw;
        private float _wakeUpTimer;
        private bool _wakingUp;

        private void Start() => PlayWakeUpPan();

        public void PlayWakeUpPan()
        {
            _wakingUp = true;
            _wakeUpTimer = 0f;
        }

        private void LateUpdate()
        {
            if (_wakingUp)
            {
                _wakeUpTimer += Time.deltaTime;
                float t = Mathf.Clamp01(_wakeUpTimer / wakeUpPanSeconds);
                _yaw = Mathf.Lerp(-25f, 0f, wakeUpEase.Evaluate(t));
                if (t >= 1f) _wakingUp = false;
            }

            ApplyTransform();
        }

        // Called by drag-gesture input to orbit the camera; deliberately
        // exposed as a small public method so the RN gesture handler (or a
        // Unity input action) can drive it without this script needing to
        // know about the input system in use.
        public void Orbit(float deltaYawDegrees) => _yaw += deltaYawDegrees;

        private void ApplyTransform()
        {
            if (worldCenter == null) return;
            var rotation = Quaternion.Euler(pitchDegrees, _yaw, 0);
            var offset = rotation * new Vector3(0, 0, -distance);
            transform.position = worldCenter.position + offset;
            transform.LookAt(worldCenter.position);
        }
    }
}
