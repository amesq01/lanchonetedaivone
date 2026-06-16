/** Fundo animado Copa do Mundo / Seleção Brasileira — versão vibrante. */
export function CopaBrasilHeaderBg() {
  const balls = [
    { left: '4%', top: '12%', size: 34, delay: '0s', duration: '4.5s' },
    { left: '72%', top: '5%', size: 28, delay: '0.8s', duration: '5s' },
    { left: '90%', top: '48%', size: 24, delay: '0.3s', duration: '4s' },
    { left: '38%', top: '58%', size: 20, delay: '1.5s', duration: '5.5s' },
    { left: '14%', top: '68%', size: 26, delay: '1.1s', duration: '4.8s' },
    { left: '58%', top: '72%', size: 18, delay: '2s', duration: '6s' },
  ];

  const stars = [
    { left: '8%', top: '30%', delay: '0s', size: 14 },
    { left: '48%', top: '10%', delay: '0.5s', size: 12 },
    { left: '65%', top: '38%', delay: '1s', size: 16 },
    { left: '28%', top: '20%', delay: '1.6s', size: 11 },
    { left: '85%', top: '22%', delay: '0.2s', size: 13 },
    { left: '52%', top: '45%', delay: '2.2s', size: 10 },
  ];

  const confetti = [
    { left: '5%', color: '#FFDF00', delay: '0s', duration: '3.2s' },
    { left: '15%', color: '#00A859', delay: '0.4s', duration: '2.8s' },
    { left: '25%', color: '#002776', delay: '0.8s', duration: '3.5s' },
    { left: '35%', color: '#FFDF00', delay: '1.2s', duration: '2.5s' },
    { left: '45%', color: '#00A859', delay: '0.2s', duration: '3s' },
    { left: '55%', color: '#FF6B00', delay: '1.6s', duration: '2.9s' },
    { left: '65%', color: '#FFDF00', delay: '0.6s', duration: '3.3s' },
    { left: '75%', color: '#002776', delay: '1s', duration: '2.7s' },
    { left: '85%', color: '#00A859', delay: '1.4s', duration: '3.1s' },
    { left: '95%', color: '#FFDF00', delay: '0.3s', duration: '2.6s' },
  ];

  return (
    <div className="copa-header-bg pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="copa-header-bg__mesh" />
      <div className="copa-header-bg__mesh-alt" />
      <div className="copa-header-bg__stripes" />
      <div className="copa-header-bg__diamonds" />
      <div className="copa-header-bg__shimmer" />

      {confetti.map((c, i) => (
        <span
          key={`confetti-${i}`}
          className="copa-header-bg__confetti"
          style={{
            left: c.left,
            backgroundColor: c.color,
            animationDelay: c.delay,
            animationDuration: c.duration,
          }}
        />
      ))}

      {stars.map((s, i) => (
        <span
          key={`star-${i}`}
          className="copa-header-bg__star"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }}
        />
      ))}

      {balls.map((b, i) => (
        <span
          key={`ball-${i}`}
          className="copa-header-bg__ball"
          style={{
            left: b.left,
            top: b.top,
            width: b.size,
            height: b.size,
            animationDelay: b.delay,
            animationDuration: b.duration,
          }}
        >
          <SoccerBallIcon />
        </span>
      ))}

      <div className="copa-header-bg__glow copa-header-bg__glow--yellow" />
      <div className="copa-header-bg__glow copa-header-bg__glow--green" />
      <div className="copa-header-bg__veil" />
    </div>
  );
}

function SoccerBallIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full drop-shadow-md" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" fill="white" stroke="#111" strokeWidth="2" />
      <path d="M32 8 L38 18 L50 20 L41 28 L43 40 L32 34 L21 40 L23 28 L14 20 L26 18 Z" fill="#111" />
      <path d="M32 8 L26 18 L14 20" stroke="#ccc" strokeWidth="0.6" />
      <path d="M50 20 L41 28 L43 40" stroke="#ccc" strokeWidth="0.6" />
      <path d="M21 40 L23 28 L14 20" stroke="#ccc" strokeWidth="0.6" />
      <path d="M43 40 L32 34 L21 40" stroke="#ccc" strokeWidth="0.6" />
    </svg>
  );
}
