# H1. Sample chapter: Heat flow in a rod

This is a short sample chapter for the lecture-notes reader. It shows numbered sections, equations with `\tag` and `\label`, a figure with a long caption, a table, one wide formula and links to other chapters. A thin rod is heated at one end and cooled at the other. We ask how the temperature along it settles, and how long that takes.

## Assumptions and symbols

- The rod is thin, so the temperature depends only on the position $x$ along it and on the time $t$.
- The side of the rod is insulated. Heat leaves only through the two ends.
- The material is uniform. Its properties do not change with temperature.

| Symbol | Meaning | Unit |
|---|---|---|
| $T(x,t)$ | temperature | K |
| $q$ | heat flux along the rod | W m⁻² |
| $k$ | thermal conductivity | W m⁻¹ K⁻¹ |
| $\rho c$ | heat capacity per volume | J m⁻³ K⁻¹ |
| $\alpha = k/\rho c$ | thermal diffusivity | m² s⁻¹ |

## Fourier's law

Heat flows from hot to cold, and the flux is proportional to the slope of the temperature:

$$
q = -k\,\frac{\partial T}{\partial x} \tag{H1.1}
$$

The minus sign makes heat run down the slope. A steeper profile carries more heat.

## The heat equation

Take a thin slice of the rod between $x$ and $x + dx$. The heat it gains per second is the flux in minus the flux out, and it raises the slice's temperature:

$$
\rho c\,\frac{\partial T}{\partial t} = -\frac{\partial q}{\partial x} \tag{H1.2}
$$

Put Fourier's law \eqref{H1.1} into the balance \eqref{H1.2}:

$$
\frac{\partial T}{\partial t} = \alpha\,\frac{\partial^2 T}{\partial x^2} \label{eq:heat}
$$

Equation \eqref{eq:heat} has no `\tag` in the source. The reader gives it the next free number.

### Diffusivity of common materials

The diffusivity sets the pace. Rounded room-temperature values, for a feel of the scale only:

| Material | $\alpha$ (mm² s⁻¹) | Time for 10 cm (order) |
|---|---|---|
| Copper | 110 | a minute |
| Aluminium | 97 | a minute |
| Carbon steel | 12 | ten minutes |
| Glass | 0.34 | eight hours |
| Water | 0.14 | a day |

## Steady state

Hold the ends at $T(0) = T_0$ and $T(L) = T_L$ and wait. Nothing changes any more, so the left side of \eqref{eq:heat} is zero and the profile is a straight line:

$$
T_\infty(x) = T_0 + (T_L - T_0)\,\frac{x}{L} \label{eq:steady}
$$

![Temperature along the rod at three times](figures/h1-profiles.svg)

*Figure H1.1.* Temperature along the rod. At $t = 0$ (dashed) the inside is uniform and only the ends are held. After one time constant $\tau$ the profile bends toward the line. As $t \to \infty$ it is the straight steady profile \eqref{eq:steady}.

## Separation of variables

Write the temperature as the steady line plus a part that dies away. Each sine mode of the rod decays on its own, and the full solution for any starting profile $T_i(x)$ is

$$
T(x,t) = T_0 + (T_L - T_0)\frac{x}{L} + \sum_{n=1}^{\infty} \frac{2}{L}\left[\int_0^L \left(T_i(\xi) - T_0 - (T_L - T_0)\frac{\xi}{L}\right)\sin\frac{n\pi\xi}{L}\,d\xi\right] \sin\frac{n\pi x}{L}\; e^{-n^2\pi^2\alpha t/L^2} \tag{H1.5}
$$

This line is wider than the text column on a phone. There it scrolls sideways on its own, and its number moves to the line below.

### The slowest mode

The $n = 1$ term decays slowest. Its time constant is the one to remember:

$$
\tau = \frac{L^2}{\pi^2 \alpha} \label{eq:tau}
$$

Double the length and the rod takes four times as long to settle. The same exponential decay, without the wiggle, appears in the [overdamped oscillator](../oscillations/o1-damped-oscillators.md#the-three-regimes). A small body that cools as one piece is treated in [H2](h2-cooling-of-a-small-body.md).

## Key results

- Fourier's law \eqref{H1.1} and the energy balance \eqref{H1.2} give the heat equation \eqref{eq:heat}.
- The steady profile is a straight line, Figure \ref{fig:h1-profiles}.
- Every mode decays; the slowest sets $\tau$ in \eqref{eq:tau}.
