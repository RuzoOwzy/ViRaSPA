// Head lookups for the sample's dynamic pages, for node-tools/serve.js:
//   node node-tools/serve.js --head-lookups server-side/head-lookups.js
// (or node-tools/lib/head-injector.js in your own Node server).
//
// Each lookup gets the route's parameters and returns the values for its
// head placeholders - PUBLIC data only - or null when the thing doesn't exist
// (the answer is then 404). Route "person" is path "/people/:id" with
//   head: { title: "{{name}} · ViRaSPA Sample", description: "{{name}} works at {{company}}. ..." }
"use strict";

module.exports = {
  siteAddress: "http://localhost:8027",
  lookups: {
    async person({ id }) {
      if (!/^\d+$/.test(id)) return null;
      const res = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`);
      if (!res.ok) return null;
      const user = await res.json();
      return { name: user.name, company: user.company && user.company.name };
    },
  },
};