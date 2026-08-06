import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Grommet } from 'grommet';
import { hpe } from 'grommet-theme-hpe';
import App from './App';
import { SettingsProvider, useSettings } from './settings/SettingsProvider';

/**
 * HPE design token CSS custom properties.
 *
 * Order matters: `primitives` defines the raw scale that everything else
 * references, so it must load first. `color.light` is loaded on its own —
 * `color.dark.css` ships in the package and can be layered behind a
 * `prefers-color-scheme` / theme-toggle strategy when SAIP decides whether it
 * supports dark mode. Out of scope for this build; see README.
 */
import 'hpe-design-tokens/dist/css/primitives.css';
import 'hpe-design-tokens/dist/css/global.css';
import 'hpe-design-tokens/dist/css/dimension.css';
import 'hpe-design-tokens/dist/css/color.light.css';
/**
 * Dark mode. HPE ships this as a first-class pair, so we load BOTH sheets and
 * let the `data-mode` attribute pick a winner — `color.light.css` scopes to
 * `:root, [data-mode=auto], [data-mode=light]` and `color.dark.css` to
 * `[data-mode=dark]` plus `[data-mode=auto]` inside a prefers-color-scheme
 * query. `SettingsProvider` writes that attribute; nothing else is needed for
 * several hundred colour tokens to flip. Order matters — dark must come second.
 */
import 'hpe-design-tokens/dist/css/color.dark.css';
import 'hpe-design-tokens/dist/css/components.css';

import './styles/fonts.css';
import './styles/global.css';

/**
 * NOTE FOR THE POWER PAGES DEVELOPER
 *
 * This file is the standalone-demo entry point only. Dropping SAIP into
 * Power Pages means rendering <App /> (or an individual component) into
 * whatever root the Web Template or PCF control provides — the <Grommet>
 * wrapper and the CSS imports above are the only things that need to come
 * with it. Authentication is deliberately absent: Power Pages resolves the
 * Entra ID identity before any of this runs.
 */
/**
 * Sits inside <SettingsProvider> so Grommet's own theme mode can follow the
 * user's choice. Grommet needs a resolved 'light' | 'dark' — it has no concept
 * of "auto" — which is exactly what `resolvedMode` provides.
 */
function Root() {
  const { resolvedMode } = useSettings();

  // No `full` prop: SAIP is designed to be embedded in a Power Pages template
  // that supplies its own document scroll. Pinning the app to 100vh and
  // scrolling internally would fight that host layout, so the app flows
  // naturally and the chrome uses `position: sticky` instead.
  return (
    <Grommet theme={hpe} themeMode={resolvedMode} background="background-back">
      {/*
        HashRouter, not BrowserRouter, and deliberately so.

        SAIP gets mounted at a path the front-end does not control, inside a
        Power Pages site whose server rewrite rules are not ours to configure.
        History routing would need every deep path (/account/:id) rewritten to
        the host page server-side, and would break on hard refresh without it.
        Hash routing needs no server cooperation and survives being mounted at
        an arbitrary sub-path.

        If Power Pages routing is used instead of client-side routing, replace
        this with whatever the host page provides — App's <Routes> is the only
        thing that needs re-pointing.
      */}
      <HashRouter>
        <App />
      </HashRouter>
    </Grommet>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/*
      Settings sit above Grommet because the theme mode they resolve is an input
      to it. They also apply `data-mode` to <html>, which is what drives the HPE
      token sheets — so this provider owns appearance for the whole document,
      not just the React tree beneath it.
    */}
    <SettingsProvider>
      <Root />
    </SettingsProvider>
  </React.StrictMode>,
);
