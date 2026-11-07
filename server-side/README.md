# Server-side helpers (optional)

ViRaSPA sites are static files: any web server can serve them with the rules `node-tools/deploy.js` writes. These files are for a server that also does **head injection** for dynamic pages such as `/people/3` (README "Dynamic pages"), so link previews and search engines see each page's own title, description and image.

| File | What it is |
| --- | --- |
| [`head-lookups.js`](head-lookups.js) | The sample's lookups, for `node node-tools/serve.js --head-lookups server-side/head-lookups.js` |
| [`aspnetcore/ViraspaSite.cs`](aspnetcore/ViraspaSite.cs) | ASP.NET Core (.NET 8 or newer): one file, `app.UseViraspaSite(options)` |
| [`../node-tools/lib/head-injector.js`](../node-tools/lib/head-injector.js) | The Node helper, for your own Node server |

## ASP.NET Core

Copy `ViraspaSite.cs` into your project and deploy the site into `wwwroot`:

```bash
node node-tools/deploy.js --destination ../VSales.Api/wwwroot --server-type none --environment production
```

Then, in `Program.cs`:

```csharp
using Viraspa.Server;

var site = new ViraspaSiteOptions { SiteAddress = "https://vsales.example.com" };
site.Lookups["person"] = async p =>
{
    var person = await db.People.FindPublicAsync(p["id"]);   // public data only
    return person is null ? null : new Dictionary<string, string> { ["name"] = person.Name, ["company"] = person.Company };
};

app.MapControllers();          // your API first: endpoints are left alone
app.UseViraspaSite(site);      // then the site: files, routes, head tags
```

Tested with .NET 10 against the sample's release: `node node-tools/check-server.js --url http://localhost:8034` passes all 65 checks; `/people/3` gets its own title, description and canonical; an unknown person answers 404; `/api/...` endpoints are untouched.

## Any other backend

1. For a GET without a file extension, look for `prerendered/<path>/index.html` and send it if it exists.
2. Match the path against `routes` in `release.json`: `:name` matches one segment, other segments in any letter case, a trailing slash is ignored, and a route without parameters wins. No match: send `index.html` with status 404.
3. A private route (`"private": true`): send `index.html` as it is.
4. Otherwise fill the route's `head` templates (`title`, `description`, `image`) from the parameters and your lookup's public values. A template with an unfilled `{{placeholder}}` falls back to the route's `title` or the site's default. Your lookup finding nothing: status 404. Your lookup failing: the plain tags, not an error.
5. Put the tags into `index.html` as `node-tools/prerender.js` does (`withHeadTags`): `<title>`, `<meta name="description">`, `canonical`, `og:*` and `twitter:*`, all HTML-escaped.
6. Send every HTML answer and `release.json` with `Cache-Control: no-cache`, and never serve `app/project-viraspa.json`.
