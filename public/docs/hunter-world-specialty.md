# Hunter World: Specialty Classes

## Overview
To give users a deeper sense of identity beyond a single letter rank (A, B, C), the Hunter World system tracks *how* users earn their points using a `categoryPoints` system, assigning them a **Specialty Class**.

## The Classes
There are currently five distinct disciplines, each mapped to a specific class title and color profile:

1. **Iron Fist (Strength)**
   - Earned via: Heavy lifting, resistance training.
   - Icon: Fiery Dumbbell
   - Color Accent: Crimson / Red (Aggressive, powerful)

2. **Shadow Runner (Endurance)**
   - Earned via: Running, long-distance cardio.
   - Icon: Winged Shoe
   - Color Accent: Electric Blue (Speed, airflow)

3. **Inferno (Burn)**
   - Earned via: HIIT, Fat Burn zones, metabolically demanding workouts.
   - Icon: Flame
   - Color Accent: Neon Orange (Heat, intensity)

4. **Phantom (Flexibility)**
   - Earned via: Yoga, stretching, mobility programming.
   - Icon: Lotus / Wind
   - Color Accent: Indigo / Purple (Calm, ethereal)

5. **Tidebreaker (Aqua - Future)**
   - Earned via: Swimming, water resistance.
   - Icon: Wave
   - Color Accent: Cyan / Teal (Fluidity)

## Technological Implementation
When a user completes an activity (via `WorkoutService`, `RunService`, `FatBurnService`), the system tags the earned Pulse Points with the corresponding discipline and atomically increments both the `lifetimePulsePoints` and `categoryPoints.{discipline}` field in Firestore.

The `User` object computes the dominant trait and assigns the user their Specialty Class dynamically. As a user's training habits shift (e.g., from winter lifting to summer running), their Specialty Class may shift from Iron Fist to Shadow Runner.
