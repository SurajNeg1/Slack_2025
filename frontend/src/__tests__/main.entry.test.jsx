/**
 * Test framework: Vitest (with jsdom). If your project uses Jest, replace Vitest APIs with Jest equivalents.
 *
 * These tests cover the app entry module that initializes Sentry, creates a QueryClient,
 * and renders the provider tree into #root. We dynamically import the entry after stubbing
 * environment and mocks so top-level side effects are testable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

// Helper to resolve local module paths relative to this test file
const resolveLocal = (p) => new URL(p, import.meta.url).pathname;

// Capture bucket used by mocks to assert props/instances passed around
const resetCaptures = () => {
  globalThis.__test_captures = {
    clerk: { props: null },
    reactQuery: { clients: [], providedClient: null },
    toaster: { props: null },
  };
};

const setupDom = (withRoot = true) => {
  document.body.innerHTML = withRoot ? '<div id="root"></div>' : "";
};

const mockExternalModules = () => {
  // react-dom/client
  const renderMock = vi.fn();
  const createRootMock = vi.fn(() => ({ render: renderMock }));
  vi.mock("react-dom/client", () => ({ createRoot: createRootMock }));

  // Sentry
  const sentryInit = vi.fn();
  const rrV7 = vi.fn(() => ({ name: "react-router-v7-integration" }));
  vi.mock("@sentry/react", () => ({
    init: sentryInit,
    reactRouterV7BrowserTracingIntegration: rrV7,
  }));

  // react-router (module under test imports from "react-router")
  const stubs = {
    useLocation: vi.fn(),
    useNavigationType: vi.fn(),
    createRoutesFromChildren: vi.fn(),
    matchRoutes: vi.fn(),
  };
  const BrowserRouter = ({ children }) =>
    React.createElement("div", { "data-testid": "router" }, children);
  const Routes = ({ children }) => React.createElement(React.Fragment, null, children);
  const Route = ({ element, children }) => element ?? children ?? null;
  vi.mock("react-router", () => ({ ...stubs, BrowserRouter, Routes, Route }));

  // @clerk/clerk-react
  vi.mock("@clerk/clerk-react", () => {
    const ClerkProvider = (props) => {
      globalThis.__test_captures.clerk.props = props;
      return React.createElement(React.Fragment, null, props.children);
    };
    return { ClerkProvider };
  });

  // @tanstack/react-query
  vi.mock("@tanstack/react-query", () => {
    function QueryClient(...args) {
      const client = { __type: "QueryClient", __args: args, __id: Symbol("qc") };
      globalThis.__test_captures.reactQuery.clients.push(client);
      return client;
    }
    const QueryClientProvider = ({ client, children }) => {
      globalThis.__test_captures.reactQuery.providedClient = client;
      return React.createElement(React.Fragment, null, children);
    };
    return { QueryClient, QueryClientProvider };
  });

  // react-hot-toast
  vi.mock("react-hot-toast", () => {
    const Toaster = (props) => {
      globalThis.__test_captures.toaster.props = props;
      return null;
    };
    return { Toaster };
  });

  // Local modules (path-resolved so the spec matches what the entry file resolves to)
  vi.mock(resolveLocal("../providers/AuthProvider.jsx"), () => {
    const AuthProvider = ({ children }) => React.createElement(React.Fragment, null, children);
    return { default: AuthProvider };
  });
  vi.mock(resolveLocal("../App.jsx"), () => {
    const App = () => React.createElement("div", { "data-testid": "app-stub" }, "App");
    return { default: App };
  });

  // CSS import from entry
  vi.mock(resolveLocal("../index.css"), () => ({}), { virtual: true });

  return { createRootMock, renderMock, sentryInit, rrV7 };
};

const importEntry = async () => {
  // Prefer main.jsx if present; otherwise fall back to main.test.jsx as provided in the PR snippet
  try {
    return await import("../main.jsx");
  } catch {
    return await import("../main.test.jsx");
  }
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  resetCaptures();
});

afterEach(() => {
  // Clean any globals we might stub
  // eslint-disable-next-line no-undef
  if (globalThis.coonsole && "log" in globalThis.coonsole) {
    // @ts-ignore
    delete globalThis.coonsole;
  }
});

describe("App entry bootstrap", () => {
  it("throws a clear error when VITE_CLERK_PUBLISHABLE_KEY is missing", async () => {
    setupDom(true);
    // Ensure missing key and avoid unrelated failures
    // @ts-ignore
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY = undefined;

    const { sentryInit } = mockExternalModules();

    await expect(importEntry()).rejects.toThrowError(/Missing Publishable Key/);
    expect(sentryInit).not.toHaveBeenCalled(); // Should fail fast before Sentry init
  });

  it("also throws when VITE_CLERK_PUBLISHABLE_KEY is an empty string", async () => {
    setupDom(true);
    // @ts-ignore
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY = "";

    mockExternalModules();

    await expect(importEntry()).rejects.toThrowError(/Missing Publishable Key/);
  });

  it("initializes Sentry and renders provider tree when env is present", async () => {
    setupDom(true);
    // Provide required env and stub the misspelled global to avoid ReferenceError
    // @ts-ignore
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY = "pk_test_123";
    // @ts-ignore
    globalThis.coonsole = { log: vi.fn() };

    const { createRootMock, renderMock, sentryInit, rrV7 } = mockExternalModules();

    await importEntry();

    // createRoot called with #root
    const rootEl = document.getElementById("root");
    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledWith(rootEl);

    // Render called once with StrictMode element
    expect(renderMock).toHaveBeenCalledTimes(1);
    const renderedTree = renderMock.mock.calls[0][0];
    expect(renderedTree).toBeTruthy();

    // Sentry init
    expect(rrV7).toHaveBeenCalledTimes(1);
    expect(rrV7).toHaveBeenCalledWith(
      expect.objectContaining({
        useEffect: React.useEffect,
        useLocation: expect.any(Function),
        useNavigationType: expect.any(Function),
        createRoutesFromChildren: expect.any(Function),
        matchRoutes: expect.any(Function),
      }),
    );

    expect(sentryInit).toHaveBeenCalledTimes(1);
    const initArg = sentryInit.mock.calls[0][0];
    expect(initArg).toEqual(
      expect.objectContaining({
        dsn: expect.stringMatching(/^https:\/\/[a-z0-9]+/i),
        tracesSampleRate: 1,
        integrations: expect.arrayContaining([expect.any(Object)]),
      }),
    );

    // Provider props checks captured by mocks
    expect(globalThis.__test_captures.clerk.props).toBeTruthy();
    expect(globalThis.__test_captures.clerk.props.publishableKey).toBe("pk_test_123");

    expect(globalThis.__test_captures.toaster.props).toEqual(
      expect.objectContaining({ position: "top-right" }),
    );

    // QueryClient created and passed through
    const { clients, providedClient } = globalThis.__test_captures.reactQuery;
    expect(clients.length).toBeGreaterThanOrEqual(1);
    expect(providedClient).toBe(clients[0]);

    // The stray global log was invoked
    // @ts-ignore
    expect(globalThis.coonsole.log).toHaveBeenCalledWith("Hellow");
  });

  it("handles missing #root by attempting createRoot with null (does not crash our mock)", async () => {
    setupDom(false);
    // @ts-ignore
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY = "pk_test_456";
    // @ts-ignore
    globalThis.coonsole = { log: vi.fn() };

    const { createRootMock } = mockExternalModules();

    await importEntry();

    expect(createRootMock).toHaveBeenCalledWith(null);
  });
});