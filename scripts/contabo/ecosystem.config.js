// NeureCore PM2 ecosystem — single source of truth for all 4 services.
// Location on Contabo: /opt/neurecore/ecosystem.config.js
// Reload: pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save
//
// To add a new service: append an entry below and run startOrReload.
// DO NOT define neurecore-* processes via ad-hoc pm2 start commands;
// always update this file so restarts are reproducible.

module.exports = {
  apps: [
    {
      name: "neurecore-backend",
      cwd: "/opt/neurecore/backend/backend",
      script: "./dist/src/main.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production", PORT: "3003" },
      out_file: "/root/.pm2/logs/neurecore-backend-out.log",
      error_file: "/root/.pm2/logs/neurecore-backend-error.log",
      merge_logs: true,
    },
    {
      name: "neurecore-tenant",
      cwd: "/opt/neurecore/frontend-tenant",
      script: "./start.sh",
      interpreter: "bash",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production", PORT: "3005" },
      out_file: "/root/.pm2/logs/neurecore-tenant-out.log",
      error_file: "/root/.pm2/logs/neurecore-tenant-error.log",
      merge_logs: true,
    },
    {
      name: "neurecore-admin",
      cwd: "/opt/neurecore/frontend-admin",
      script: "./start.sh",
      interpreter: "bash",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production", PORT: "3020" },
      out_file: "/root/.pm2/logs/neurecore-admin-out.log",
      error_file: "/root/.pm2/logs/neurecore-admin-error.log",
      merge_logs: true,
    },
    {
      name: "neurecore-cors-proxy",
      cwd: "/opt/neurecore",
      script: "./cors-proxy.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "128M",
      out_file: "/root/.pm2/logs/neurecore-cors-proxy-out.log",
      error_file: "/root/.pm2/logs/neurecore-cors-proxy-error.log",
      merge_logs: true,
    },
  ],
};
