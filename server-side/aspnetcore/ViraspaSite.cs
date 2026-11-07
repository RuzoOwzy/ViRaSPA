// ASP.NET Core reference: serves a deployed ViRaSPA site (wwwroot = a
// release written by node-tools/deploy.js) the way the framework expects,
// with head injection for dynamic pages (README "Dynamic pages").
//
//   var site = new ViraspaSiteOptions { SiteAddress = "https://vsales.example.com" };
//   site.Lookups["person"] = async p => await db.PublicProfile(p["id"]); // null: doesn't exist (404)
//   app.UseViraspaSite(site);   // after your API endpoints / UseRouting
//
// What it does, for GET/HEAD requests:
//   - files (with an extension) are served as static files; release.json and
//     every HTML answer are sent with Cache-Control: no-cache; the tool
//     settings file app/project-viraspa.json is never served;
//   - an app address (no extension): its prerendered copy if there is one,
//     else index.html with the route's head tags filled in - title,
//     description, preview image, canonical - from the route's parameters
//     and your lookup's values (public data only). Private routes get the
//     plain index.html. Unknown addresses, and lookups that return null,
//     answer 404 (with the app, which shows its not-found page).
// Routes come from release.json (deploy.js writes them there) and follow the
// browser's rules: ":name" is one segment, other segments match in any
// letter case, a trailing slash is ignored, routes without parameters win.
// The site is assumed to be at the web root.
using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Net.Http.Headers;

namespace Viraspa.Server;

public sealed class ViraspaSiteOptions
{
    /// <summary>The published address, e.g. https://vsales.example.com - for canonical and preview links.</summary>
    public string SiteAddress { get; set; } = "";

    /// <summary>Route name -> placeholder values for its head templates (public data only), or null when the thing doesn't exist.</summary>
    public Dictionary<string, Func<IReadOnlyDictionary<string, string>, Task<IReadOnlyDictionary<string, string>?>>> Lookups { get; } = new(StringComparer.Ordinal);
}

public static class ViraspaSiteExtensions
{
    public static IApplicationBuilder UseViraspaSite(this IApplicationBuilder app, ViraspaSiteOptions options)
    {
        var env = app.ApplicationServices.GetRequiredService<IWebHostEnvironment>();
        var root = env.WebRootPath ?? throw new InvalidOperationException("No wwwroot (WebRootPath) is set.");
        var site = new ViraspaSite(root, options);

        app.Use(async (context, next) =>
        {
            var path = context.Request.Path.Value ?? "/";
            if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method)) { await next(); return; }
            if (path.Equals("/app/project-viraspa.json", StringComparison.OrdinalIgnoreCase)) { context.Response.StatusCode = 404; return; }
            // API endpoints (minimal APIs, controllers) and files go their own way.
            if (context.GetEndpoint() is not null || Path.HasExtension(path)) { await next(); return; }
            await site.ServePage(context, path);
        });

        var types = new FileExtensionContentTypeProvider();
        types.Mappings[".webmanifest"] = "application/manifest+json";
        types.Mappings[".json"] = "application/json; charset=utf-8";
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(root),
            ContentTypeProvider = types,
            OnPrepareResponse = ctx =>
            {
                var name = ctx.File.Name;
                if (name.EndsWith(".html", StringComparison.OrdinalIgnoreCase) || name.Equals("release.json", StringComparison.OrdinalIgnoreCase))
                    ctx.Context.Response.Headers[HeaderNames.CacheControl] = "no-cache";
            },
        });
        return app;
    }
}

internal sealed class ViraspaSite(string root, ViraspaSiteOptions options)
{
    private sealed record Route(string Path, string Name, string Title, bool Private, Dictionary<string, string> Head, Regex Pattern, string[] Keys);
    private sealed record Snapshot(DateTime Stamp, List<Route> Routes, string Index, string Title, string Description);
    private Snapshot? _snapshot;
    private static readonly ConcurrentDictionary<string, Regex> Patterns = new();

    public async Task ServePage(HttpContext context, string path)
    {
        var appPath = path.Length > 1 ? path.TrimEnd('/') : path;
        var snapshot = Load();

        // A prerendered copy (node-tools/prerender.js) answers as it is.
        var prerendered = System.IO.Path.Combine(root, "prerendered", appPath.TrimStart('/').Replace('/', System.IO.Path.DirectorySeparatorChar), "index.html");
        if (File.Exists(prerendered) && System.IO.Path.GetFullPath(prerendered).StartsWith(System.IO.Path.GetFullPath(root), StringComparison.OrdinalIgnoreCase))
        {
            await Send(context, 200, await File.ReadAllTextAsync(prerendered));
            return;
        }

        var (route, values) = Match(snapshot.Routes, appPath);
        if (route is null) { await Send(context, 404, snapshot.Index); return; }
        if (route.Private) { await Send(context, 200, snapshot.Index); return; }

        var data = new Dictionary<string, string>(values, StringComparer.Ordinal);
        if (options.Lookups.TryGetValue(route.Name, out var lookup))
        {
            IReadOnlyDictionary<string, string>? found;
            try
            {
                found = await lookup(values);
            }
            catch (Exception error)
            {
                // A failing lookup (database down...) must not take the page down:
                // the app still loads, with the route's plain head tags.
                context.RequestServices.GetService<Microsoft.Extensions.Logging.ILoggerFactory>()?
                    .CreateLogger("ViraspaSite").LogWarning(error, "Head lookup for route {Route} failed", route.Name);
                found = new Dictionary<string, string>();
            }
            if (found is null) { await Send(context, 404, snapshot.Index); return; }
            foreach (var (key, value) in found) data[key] = value;
        }

        string Fill(string key) => route.Head.TryGetValue(key, out var template) ? FillTemplate(template, data) : "";
        var baseAddress = options.SiteAddress.TrimEnd('/');
        var image = Fill("image");
        if (image.Length > 0 && !image.StartsWith("http", StringComparison.OrdinalIgnoreCase)) image = baseAddress.Length > 0 ? $"{baseAddress}/{image.TrimStart('/')}" : "";
        var head = new Head(
            Title: NonEmpty(Fill("title"), route.Title, snapshot.Title),
            Description: NonEmpty(Fill("description"), snapshot.Description),
            Image: image,
            Canonical: baseAddress.Length > 0 ? baseAddress + Build(route.Path, values) : "");
        await Send(context, 200, WithHeadTags(snapshot.Index, head));
    }

    private Snapshot Load()
    {
        var releaseFile = System.IO.Path.Combine(root, "release.json");
        var stamp = File.Exists(releaseFile) ? File.GetLastWriteTimeUtc(releaseFile) : DateTime.MinValue;
        var current = _snapshot;
        if (current is not null && current.Stamp == stamp) return current;

        var routes = new List<Route>();
        if (File.Exists(releaseFile))
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(releaseFile));
            if (doc.RootElement.TryGetProperty("routes", out var list))
            {
                foreach (var r in list.EnumerateArray())
                {
                    var routePath = r.GetProperty("path").GetString() ?? "/";
                    var head = new Dictionary<string, string>(StringComparer.Ordinal);
                    if (r.TryGetProperty("head", out var h) && h.ValueKind == JsonValueKind.Object)
                        foreach (var p in h.EnumerateObject()) if (p.Value.ValueKind == JsonValueKind.String) head[p.Name] = p.Value.GetString() ?? "";
                    var keys = Regex.Matches(routePath, ":([A-Za-z_][A-Za-z0-9_]*)").Select(m => m.Groups[1].Value).ToArray();
                    routes.Add(new Route(routePath, r.GetProperty("name").GetString() ?? "", r.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
                        r.TryGetProperty("private", out var pr) && pr.GetBoolean(), head, Compile(routePath), keys));
                }
            }
        }
        var index = File.ReadAllText(System.IO.Path.Combine(root, "index.html"));
        var title = Regex.Match(index, "<title>([\\s\\S]*?)</title>", RegexOptions.IgnoreCase).Groups[1].Value.Trim();
        var description = Regex.Match(index, "<meta\\s+name=\"description\"\\s+content=\"([^\"]*)\"", RegexOptions.IgnoreCase).Groups[1].Value;
        current = new Snapshot(stamp, routes, index, WebUtility.HtmlDecode(title), WebUtility.HtmlDecode(description));
        _snapshot = current;
        return current;
    }

    // The browser's rules (viraspa/core/route-paths.js).
    private static Regex Compile(string routePath) => Patterns.GetOrAdd(routePath, p =>
    {
        var trimmed = p.Length > 1 ? p.TrimEnd('/') : p;
        var parts = trimmed.Split('/').Skip(1).Select(s => Regex.IsMatch(s, "^:[A-Za-z_][A-Za-z0-9_]*$") ? "([^/]+)" : Regex.Escape(s));
        return new Regex("^/" + string.Join("/", parts) + "/?$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    });

    private static (Route?, IReadOnlyDictionary<string, string>) Match(List<Route> routes, string appPath)
    {
        (Route?, IReadOnlyDictionary<string, string>) withParams = (null, new Dictionary<string, string>());
        foreach (var route in routes)
        {
            var m = route.Pattern.Match(appPath);
            if (!m.Success) continue;
            if (route.Keys.Length == 0) return (route, new Dictionary<string, string>());
            if (withParams.Item1 is not null) continue;
            var values = new Dictionary<string, string>(StringComparer.Ordinal);
            for (var i = 0; i < route.Keys.Length; i++) values[route.Keys[i]] = Uri.UnescapeDataString(m.Groups[i + 1].Value);
            withParams = (route, values);
        }
        return withParams;
    }

    // The route's own spelling with the values: "/people/:id" + { id = 3 } -> "/people/3".
    private static string Build(string routePath, IReadOnlyDictionary<string, string> values)
    {
        var trimmed = routePath.Length > 1 ? routePath.TrimEnd('/') : routePath;
        return Regex.Replace(trimmed, ":([A-Za-z_][A-Za-z0-9_]*)", m => values.TryGetValue(m.Groups[1].Value, out var v) ? Uri.EscapeDataString(v) : m.Value);
    }

    // Every {{placeholder}} filled, or "" when one has no value (then the plain title / default is used).
    private static string FillTemplate(string template, IReadOnlyDictionary<string, string> data)
    {
        var missing = false;
        var result = Regex.Replace(template, "\\{\\{\\s*([\\w.]+)\\s*\\}\\}", m =>
        {
            if (data.TryGetValue(m.Groups[1].Value, out var v) && !string.IsNullOrEmpty(v)) return v;
            missing = true;
            return "";
        });
        return missing ? "" : result;
    }

    private static string NonEmpty(params string[] values) => values.FirstOrDefault(v => !string.IsNullOrEmpty(v)) ?? "";

    private sealed record Head(string Title, string Description, string Image, string Canonical);

    // The same tags node-tools/prerender.js writes.
    private static string WithHeadTags(string index, Head head)
    {
        string A(string s) => WebUtility.HtmlEncode(s);
        var html = Regex.Replace(index, "<title>[\\s\\S]*?</title>", _ => $"<title>{A(head.Title)}</title>", RegexOptions.IgnoreCase);
        html = Regex.Replace(html, "<meta\\s+name=\"description\"[^>]*>", _ => $"<meta name=\"description\" content=\"{A(head.Description)}\">", RegexOptions.IgnoreCase);
        var tags = new List<string>();
        if (head.Canonical.Length > 0) tags.Add($"<link rel=\"canonical\" href=\"{A(head.Canonical)}\" data-vs-head>");
        tags.Add("<meta property=\"og:type\" content=\"website\" data-vs-head>");
        tags.Add($"<meta property=\"og:title\" content=\"{A(head.Title)}\" data-vs-head>");
        if (head.Description.Length > 0) tags.Add($"<meta property=\"og:description\" content=\"{A(head.Description)}\" data-vs-head>");
        if (head.Canonical.Length > 0) tags.Add($"<meta property=\"og:url\" content=\"{A(head.Canonical)}\" data-vs-head>");
        if (head.Image.Length > 0) tags.Add($"<meta property=\"og:image\" content=\"{A(head.Image)}\" data-vs-head>");
        tags.Add($"<meta name=\"twitter:card\" content=\"{(head.Image.Length > 0 ? "summary_large_image" : "summary")}\" data-vs-head>");
        tags.Add($"<meta name=\"twitter:title\" content=\"{A(head.Title)}\" data-vs-head>");
        if (head.Description.Length > 0) tags.Add($"<meta name=\"twitter:description\" content=\"{A(head.Description)}\" data-vs-head>");
        if (head.Image.Length > 0) tags.Add($"<meta name=\"twitter:image\" content=\"{A(head.Image)}\" data-vs-head>");
        var block = new StringBuilder("  <!-- Head tags by ViraspaSite.cs -->\n");
        foreach (var tag in tags) block.Append("  ").Append(tag).Append('\n');
        var at = html.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
        return at < 0 ? html : html[..at] + block + html[at..];
    }

    private static async Task Send(HttpContext context, int status, string html)
    {
        context.Response.StatusCode = status;
        context.Response.ContentType = "text/html; charset=utf-8";
        context.Response.Headers[HeaderNames.CacheControl] = "no-cache";
        if (!HttpMethods.IsHead(context.Request.Method)) await context.Response.WriteAsync(html);
    }
}
