// Web server rules for a deployed ViRaSPA site, for IIS (web.config),
// Apache (.htaccess) and nginx (a snippet to include in the server block).
// They make the server:
//   1. answer /about from prerendered/about/index.html when that file exists;
//   2. answer other addresses without a file extension with index.html (the
//      router shows the page) - with status 404 when the address is not a
//      known route (from prerendered/routes.json or the routes list);
//   3. send index.html (and release.json) with Cache-Control: no-cache, so a
//      new release reaches browsers on their next visit;
//   4. never serve app/project-viraspa.json (the tool settings).
// They assume the site is served from the web root ("/").
"use strict";

const SERVER_TYPES = ["iis", "apache", "nginx", "none"];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function knownRoutesPattern(knownPaths) {
  // "/" plus each path, e.g. ^/(about|contact|users)?/?$
  const parts = knownPaths.filter((p) => p !== "/").map((p) => escapeRegex(p.replace(/^\/+/, "")));
  return parts.length ? `^/(${parts.join("|")})?/?$` : "^/$";
}

function iis(knownPaths) {
  const known = knownRoutesPattern(knownPaths).replace(/^\^\//, "^");
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by node-tools/deploy.js for a ViRaSPA site. Needs the IIS URL Rewrite module. -->
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ViRaSPA: hide tool settings" stopProcessing="true">
          <match url="^app/project-viraspa\\.json$" ignoreCase="true" />
          <action type="CustomResponse" statusCode="404" statusReason="Not Found" statusDescription="Not Found" />
        </rule>
        <rule name="ViRaSPA: prerendered pages" stopProcessing="true">
          <match url="^(.*?)/?$" />
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{DOCUMENT_ROOT}\\prerendered\\{R:1}\\index.html" matchType="IsFile" />
          </conditions>
          <action type="Rewrite" url="prerendered/{R:1}/index.html" />
        </rule>
        <rule name="ViRaSPA: unknown addresses get 404" stopProcessing="true">
          <match url="^[^.]*$" />
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{URL}" pattern="${known}" negate="true" ignoreCase="true" />
          </conditions>
          <action type="CustomResponse" statusCode="404" statusReason="Not Found" statusDescription="Not Found" />
        </rule>
        <rule name="ViRaSPA: routes go to index.html" stopProcessing="true">
          <match url="^[^.]*$" />
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="index.html" />
        </rule>
      </rules>
    </rewrite>
    <!-- 404 answers show the app (its not-found page), keeping the 404 status. -->
    <httpErrors errorMode="Custom" existingResponse="Replace">
      <remove statusCode="404" />
      <error statusCode="404" path="/index.html" responseMode="ExecuteURL" />
    </httpErrors>
    <staticContent>
      <remove fileExtension=".json" />
      <mimeMap fileExtension=".json" mimeType="application/json; charset=utf-8" />
      <remove fileExtension=".webmanifest" />
      <mimeMap fileExtension=".webmanifest" mimeType="application/manifest+json" />
      <remove fileExtension=".woff2" />
      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
    </staticContent>
  </system.webServer>
  <location path="index.html">
    <system.webServer>
      <staticContent>
        <clientCache cacheControlMode="DisableCache" />
      </staticContent>
    </system.webServer>
  </location>
  <location path="release.json">
    <system.webServer>
      <staticContent>
        <clientCache cacheControlMode="DisableCache" />
      </staticContent>
    </system.webServer>
  </location>
</configuration>
`;
}

function apache(knownPaths) {
  return `# Written by node-tools/deploy.js for a ViRaSPA site. Needs mod_rewrite and mod_headers.
Options -MultiViews
RewriteEngine On

# Never serve the tool settings.
RewriteRule ^app/project-viraspa\\.json$ - [R=404,L,NC]

# Prerendered pages: /about -> prerendered/about/index.html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{DOCUMENT_ROOT}/prerendered%{REQUEST_URI}/index.html -f
RewriteRule ^(.*?)/?$ prerendered/$1/index.html [L]

# Unknown addresses (not a file, not a known route): 404, showing the app.
ErrorDocument 404 /index.html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_URI} !${knownRoutesPattern(knownPaths)} [NC]
RewriteRule ^[^.]*$ - [R=404,L]

# Routes: index.html, the router shows the page.
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^[^.]*$ index.html [L]

<FilesMatch "^(index\\.html|release\\.json)$">
  Header set Cache-Control "no-cache"
</FilesMatch>
`;
}

function nginx(knownPaths) {
  const entries = ["/", ...knownPaths.filter((p) => p !== "/")].map((p) => `    "~*^${escapeRegex(p)}/?$" 1;`).join("\n");
  return `# Written by node-tools/deploy.js for a ViRaSPA site.
# Put the map in the http { } block and the rest in the site's server { } block.

map $uri $viraspa_known_route {
    default 0;
${entries}
}

# --- server { } block -----------------------------------------------------
location = /app/project-viraspa.json { return 404; }

location = /index.html   { add_header Cache-Control "no-cache"; }
location = /release.json { add_header Cache-Control "no-cache"; }

# 404 answers show the app (its not-found page), keeping the 404 status.
error_page 404 /index.html;

location / {
    # prerendered page, then a real file, then the app
    try_files /prerendered$uri/index.html $uri @viraspa_route;
}

location @viraspa_route {
    if ($viraspa_known_route = 0) { return 404; }
    add_header Cache-Control "no-cache";
    rewrite ^ /index.html break;
}
`;
}

// { fileName, content, inSite } - inSite: written into the site folder
// (web.config, .htaccess) or beside it (the nginx snippet isn't served).
function generate(serverType, knownPaths) {
  if (serverType === "iis") return { fileName: "web.config", content: iis(knownPaths), inSite: true };
  if (serverType === "apache") return { fileName: ".htaccess", content: apache(knownPaths), inSite: true };
  if (serverType === "nginx") return { fileName: "viraspa-nginx.conf", content: nginx(knownPaths), inSite: false };
  return null;
}

module.exports = { SERVER_TYPES, generate };
