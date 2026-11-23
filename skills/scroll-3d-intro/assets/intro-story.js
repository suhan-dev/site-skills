/* The story's timing, shared by the controller (intro.js: headlines, dots, the end) and read before three.js loads, so
   the headlines follow the scroll even without WebGL. The picture's own timing (camera keys, events) is in the scene
   module (scenes/example-device.js); keep the p values of both in step.

   RUN, in screen heights: STORY screens of story (p 0 → 1), HOLD screens on the last beat, FADE screens where the
   picture brightens into the page colour. The section is 100svh × (1 + STORY + HOLD + FADE) tall: set the same number
   in intro.css (.ix height). The example: 100 × (1 + 2 + 0.45 + 0.28) = 373svh.

   BEATS: one per headline, in story progress p. The headline fades in a → b and out c → d. The first one is on screen
   from the first paint (a, b < 0); the last one never fades out (c, d > 1), the end fade takes it away. A headline arrives
   while the camera moves, never in a pause; only the last beat may hold. */
export const RUN = { STORY: 2, HOLD: 0.45, FADE: 0.28 };

export const BEATS = [
  [-1, -0.5, 0.10, 0.15],          // Example Lab (title)
  [0.20, 0.25, 0.42, 0.47],        // Open It Up
  [0.50, 0.55, 0.70, 0.75],        // Every Layer
  [0.80, 0.86, 9, 10],             // One Chip (holds to the end)
];
