// Web server rules for a deployed ViRaSPA site, for IIS (web.config),
// Apache (.htaccess) and nginx (a snippet to include in the server block).
// They make the server:
//   1. answer /about from prerendered/about/index.html when that file exists;
//   2. answer other addresses without a file extension with index.html (the
//      router shows the page) - with status 404 when the address is not a
//      known route (from prerendered/routes.json or the routes list);
//   3. send every HTML answer (index.html, prerendered pages) and release.json
//      with Cache-Control: no-cache, so a new release reaches browsers on
//      their next visit;
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
      <outboundRules>
        <rule name="ViRaSPA: HTML answers are not cached">
          <match serverVariable="RESPONSE_Cache_Control" pattern=".*" />
          <conditions>
            <add input="{RESPONSE_CONTENT_TYPE}" pattern="^text/html" />
          </conditions>
          <action type="Rewrite" value="no-cache" />
        </rule>
      </outboundRules>
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

// nginx needs two pieces: maps (http { } level) and the site rules (server
// { } level), written as two files to include.
function nginxHttp(knownPaths) {
  const entries = ["/", ...knownPaths.filter((p) => p !== "/")].map((p) => `    "~*^${escapeRegex(p)}/?$" 1;`).join("\n");
  return `# Written by node-tools/deploy.js for a ViRaSPA site.
# Include this file in the http { } block (nginx.conf), once.

# Known app routes (any letter case, optional trailing slash).
map $uri $viraspa_known_route {
    default 0;
${entries}
}

# Every HTML answer (index.html, prerendered pages, the app for a route) is
# sent with no-cache, so a new release reaches browsers on their next visit.
map $sent_http_content_type $viraspa_cache_control {
    default "";
    ~*^text/html "no-cache";
}
`;
}

function nginxServer() {
  return `# Written by node-tools/deploy.js for a ViRaSPA site.
# Include this file in the site's server { } block; the http-level file
# (…-nginx-http.conf) must be included in the http { } block.

add_header Cache-Control $viraspa_cache_control;

location = /app/project-viraspa.json { return 404; }
location = /release.json { add_header Cache-Control "no-cache"; }

# 404 answers show the app (its not-found page), keeping the 404 status.
error_page 404 /index.html;

location / {
    # prerendered page, then a real file, then the app
    try_files /prerendered$uri/index.html $uri @viraspa_route;
}

location @viraspa_route {
    if ($viraspa_known_route = 0) { return 404; }
    rewrite ^ /index.html break;
}
`;
}
// { fileName, content, inSite, files } - inSite: written into the site
// folder (web.config, .htaccess) or beside it (the nginx files aren't
// served). `files` lists every file: [{ fileName, content }].
function generate(serverType, knownPaths) {
  const one = (fileName, content, inSite) => ({ fileName, content, inSite, files: [{ fileName, content }] });
  if (serverType === "iis") return one("web.config", iis(knownPaths), true);
  if (serverType === "apache") return one(".htaccess", apache(knownPaths), true);
  if (serverType === "nginx") {
    const files = [
      { fileName: "nginx-http.conf", content: nginxHttp(knownPaths) },
      { fileName: "nginx-server.conf", content: nginxServer(knownPaths) },
    ];
    return { fileName: files[1].fileName, content: files[1].content, inSite: false, files };
  }
  return null;
}

module.exports = { SERVER_TYPES, generate };
