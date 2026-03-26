## Design Context

### Users

Technical developers debugging web performance. They arrive with a URL and want to leave with a clear understanding of what's wrong and what to fix first. The interface should evoke **confidence** (the data is accurate) and **clarity** (the next step is obvious).

### Brand Personality

**Technical, Warm, Actionable.**
Expert knowledge delivered in an approachable, earthy way with clear next steps. The Vecton aesthetic: warm beige canvas, orange energy, monospace precision.

### Design Principles

1. **Data first, decoration second.** Every visual element must serve the metric.
2. **Warm precision.** Monospace (JetBrains Mono) for data, sans-serif (Instrument Sans) for narrative.
3. **Opacity as depth.** Layer with opacity variants (vecton-dark/5 through /80), never shadows.
4. **Pills over prose.** Badges and compact indicators over long text labels.
5. **Progressive disclosure.** Score first, then issues, then code. Never overwhelm.

### Key Tokens

- Orange `#FF5631`, Purple `#7E43BA`, Beige bg `#E8E9D7`, Dark text `#24140D`
- Good `#0cce6b`, Needs work `#ffa400`, Poor `#ff4e42`
- Fonts: Instrument Sans (body), JetBrains Mono (data/code)
- No shadows. Rounded-lg cards, rounded-full pills. Light mode only.
