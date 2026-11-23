# O1. Sample chapter: Damped oscillators

A third short sample chapter, in the second part. It shows an `align` block with one number per row, an inline SVG figure that follows light and dark, a code block, and a reference to an equation in another part.

## The equation of motion

A mass $m$ on a spring $k$ with a damper $b$ obeys

$$
m\ddot{x} + b\dot{x} + kx = 0 \tag{O1.1}
$$

Two rates describe it. Each row below has its own number:

$$
\begin{align}
\omega_0 &= \sqrt{k/m} \tag{O1.2} \\
\gamma &= \frac{b}{2m} \tag{O1.3}
\end{align}
$$

## The three regimes

Compare the damping rate $\gamma$ with the natural frequency $\omega_0$ from \eqref{O1.2} and \eqref{O1.3}.

| Regime | Condition | What you see |
|---|---|---|
| Underdamped | $\gamma < \omega_0$ | oscillation inside a decaying envelope |
| Critically damped | $\gamma = \omega_0$ | the fastest return without overshoot |
| Overdamped | $\gamma > \omega_0$ | a slow creep back, no oscillation |

<figure id="fig:o1-regimes">
<svg viewBox="0 0 520 220" width="520" role="img" aria-label="Displacement against time for the three regimes">
  <path d="M40 20V200M40 110H500" stroke="var(--ink4)" stroke-width="1"/>
  <path d="M40 30C70 30 80 190 115 190S160 50 190 50S235 160 265 160S305 80 330 80S370 135 395 135S430 98 450 98S480 118 500 116" fill="none" stroke="var(--ink)" stroke-width="1.8"/>
  <path d="M40 30C80 30 110 96 160 106S300 110 500 110" fill="none" stroke="var(--accent)" stroke-width="2"/>
  <path d="M40 30C120 34 200 66 300 86S440 104 500 106" fill="none" stroke="var(--ink3)" stroke-width="1.8" stroke-dasharray="6 5"/>
  <text x="504" y="115" font-size="15" fill="var(--ink3)">t</text>
  <text x="20" y="26" font-size="15" fill="var(--ink3)">x</text>
  <text x="200" y="40" font-size="15" fill="var(--ink2)">underdamped</text>
  <text x="420" y="150" font-size="15" fill="var(--accent)">critical</text>
  <text x="372" y="78" font-size="15" fill="var(--ink3)">overdamped</text>
</svg>
<figcaption>Displacement after a release from rest, in the three regimes. The curves are drawn with the site's colour tokens, so they follow light and dark.</figcaption>
</figure>

### Underdamped motion

For light damping the mass oscillates at a slightly lower frequency inside an exponential envelope:

$$
x(t) = A\,e^{-\gamma t}\cos(\omega_d t + \varphi), \qquad \omega_d = \sqrt{\omega_0^2 - \gamma^2} \label{eq:under}
$$

A heated rod has no inertia, so its modes only decay: compare the rod's time constant \eqref{H1.6} with the envelope in \eqref{eq:under}.

## Energy and the quality factor

The energy falls twice as fast as the amplitude, $E(t) \approx E_0\,e^{-2\gamma t}$. The quality factor counts how many radians pass while the energy falls by a factor $e$:

$$
Q = \frac{\omega_0}{2\gamma} \label{eq:q}
$$

A short script turns a measured ring-down into $Q$:

```python
import math
def quality(f0_hz, decay_time_s):
    # decay_time_s: time for the amplitude to fall by 1/e
    return math.pi * f0_hz * decay_time_s
```

## Key results

- The ratio $\gamma/\omega_0$ picks the regime, Figure \ref{fig:o1-regimes}.
- $Q$ in \eqref{eq:q} measures how long the motion rings.
