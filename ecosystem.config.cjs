module.exports = {
  apps: [
    {
      name: "central-keys",
      script: "src/index.js",
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
