import { useState } from "react";

// A tiny interactive React island. Its only job is to prove the @astrojs/react
// integration hydrates in the browser (client:load on the page). Swap this for
// your real hackathon UI — this seed is a starting point, not a product.
export default function HackathonApp() {
  const [teammates, setTeammates] = useState(0);

  return (
    <section
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: "32rem",
        margin: "2rem auto",
        padding: "1.5rem",
        border: "1px solid #ddd",
        borderRadius: "0.75rem",
      }}
    >
      <h2>Teammate finder (seed)</h2>
      <p>A live React island — proof the stack hydrates. Make it yours.</p>
      <button type="button" onClick={() => setTeammates((n) => n + 1)}>
        Teammates found: {teammates}
      </button>
    </section>
  );
}
