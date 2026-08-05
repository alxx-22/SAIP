import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Grommet } from 'grommet';
import { hpe } from 'grommet-theme-hpe';
import App from './App';

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
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/*
      No `full` prop: SAIP is designed to be embedded in a Power Pages template
      that supplies its own header, footer and document scroll. Pinning the app
      to 100vh and scrolling internally would fight that host layout, so the app
      flows naturally and the header uses `position: sticky` instead.
    */}
    <Grommet theme={hpe} background="background-back">
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
  </React.StrictMode>,
);
