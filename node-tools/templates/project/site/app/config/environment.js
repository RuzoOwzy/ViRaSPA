// Settings that differ between environments (development, staging,
// production). node-tools/deploy.js writes this file for the target it
// deploys to, from app/project-viraspa.json ("deploy" > "environments");
// this copy is the development one. Anything here is public - no secrets.
window.Viraspa.environment = {
  name: "development",
  settings: {
    apiBaseAddress: "https://api.example.com",
  },
};
