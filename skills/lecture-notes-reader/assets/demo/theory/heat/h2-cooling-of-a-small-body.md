# H2. Sample chapter: Cooling of a small body

A second short sample chapter. It is mostly here so that the reader has a neighbour to step to, and a link back to [H1](h1-heat-flow-in-a-rod.md).

## The lumped model

A small metal ball sits in moving air at $T_\infty$. If heat moves inside the ball much faster than it leaves through the surface, the ball has one temperature $T(t)$. The heat lost through the surface area $A$, with a transfer coefficient $h$, lowers it:

$$
m c\,\frac{dT}{dt} = -h A\,(T - T_\infty) \tag{H2.1}
$$

The solution is an exponential approach to the air temperature:

$$
T(t) = T_\infty + (T_i - T_\infty)\,e^{-t/\tau_c}, \qquad \tau_c = \frac{m c}{h A} \tag{H2.2}
$$

## When the model holds

Inside the ball, heat still moves by Fourier's law \eqref{H1.1} of chapter H1. The ball is "one piece" when that inner flow is fast compared with the surface loss. The ratio of the two is the Biot number:

$$
\mathrm{Bi} = \frac{h L_c}{k}, \qquad L_c = \frac{V}{A} \label{eq:biot}
$$

> A common rule: the lumped model is good to a few percent when $\mathrm{Bi} < 0.1$.

Radiation adds a second loss term. It will be treated in [H3](h3-radiation.md), which is not published yet, so the link shows as plain grey text.
