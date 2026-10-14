"use client";

// Last-resort boundary: renders its own <html>/<body> when the root layout
// itself fails (audit A-06). Kept deliberately minimal and self-contained.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Georgia, 'Times New Roman', serif", background: "#faf9f7" }}>
        <main
          style={{
            minHeight: "70vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "1rem",
            color: "#1c1917",
          }}
        >
          <p style={{ letterSpacing: "0.2em", fontSize: "12px", textTransform: "uppercase" }}>
            Something went wrong
          </p>
          <h1 style={{ fontSize: "2rem", marginTop: "0.75rem" }}>
            The store could not be displayed
          </h1>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "2rem",
              height: "3rem",
              padding: "0 2rem",
              background: "#1c1917",
              color: "#faf9f7",
              border: "none",
              cursor: "pointer",
              letterSpacing: "0.18em",
              fontSize: "12px",
              textTransform: "uppercase",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
