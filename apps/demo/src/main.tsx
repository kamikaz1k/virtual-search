import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const rootElement = document.querySelector("#root");

if (!rootElement) {
  throw new Error('Virtual Search demo requires an element with id "root"');
}

const root = createRoot(rootElement);

void import("./App")
  .then(({ App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error("Virtual Search demo failed to start", error);
    const message = error instanceof Error ? error.message : String(error);

    root.render(
      <main className="startup-error" role="alert">
        <p>Virtual Search demo failed to start.</p>
        <pre>{message}</pre>
        <p>
          Run <code>pnpm install</code>, then <code>pnpm dev</code>, and open
          the URL printed by Vite.
        </p>
      </main>,
    );
  });
