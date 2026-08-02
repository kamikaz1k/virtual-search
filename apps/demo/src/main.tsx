import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./demo-chrome.css";

const rootElement = document.querySelector("#root");

if (!rootElement) {
  throw new Error('Virtual Search demo requires an element with id "root"');
}

const normalizedPath = globalThis.location?.pathname.replace(/\/+$/, "");
const isVueDemo = normalizedPath?.endsWith("/vue") ?? false;

const startup = isVueDemo
  ? import("./vue-demo/mount").then(({ mountVueDemo }) => {
      mountVueDemo(rootElement);
    })
  : import("./App").then(({ App }) => {
      const root = createRoot(rootElement);
      root.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    });

void startup
  .catch((error: unknown) => {
    console.error("Virtual Search demo failed to start", error);
    const message = error instanceof Error ? error.message : String(error);
    rootElement.replaceChildren();
    const errorRoot = createRoot(rootElement);
    errorRoot.render(
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
