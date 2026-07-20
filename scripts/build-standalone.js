// Builds prototype/guild-of-the-open-mic.html: the single-file public demo.
// Bundles prototype/guild-idle.jsx with React inlined (from client/node_modules),
// minified, NODE_ENV=production, then inlines the JS into a minimal HTML shell.
// Run after ANY prototype change (see CLAUDE.md), then sync gh-pages:index.html
// byte-identically with the result.
//
// Usage: node scripts/build-standalone.js
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const esbuild = require(path.join(root, "client/node_modules/esbuild"));

(async () => {
  const result = await esbuild.build({
    stdin: {
      contents: [
        'import React from "react";',
        'import { createRoot } from "react-dom/client";',
        'import App from "./prototype/guild-idle.jsx";',
        'createRoot(document.getElementById("root")).render(React.createElement(App));',
      ].join("\n"),
      resolveDir: root,
      loader: "jsx",
    },
    bundle: true,
    minify: true,
    write: false,
    define: { "process.env.NODE_ENV": '"production"' },
    loader: { ".jsx": "jsx" },
    nodePaths: [path.join(root, "client/node_modules")],
  });
  // </script inside the bundle would close the inline tag early
  const js = result.outputFiles[0].text.replace(/<\/script/g, "<\\/script");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Guild of the Open Mic</title>
<style>
  html, body { margin: 0; padding: 0; background: #100e1a; min-height: 100%; }
</style>
</head>
<body>
<div id="root"></div>
<script>
${js}
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(root, "prototype/guild-of-the-open-mic.html"), html);
  console.log("BUILT", html.length, "bytes");
})().catch((e) => { console.error(e); process.exit(1); });
