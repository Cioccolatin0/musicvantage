module.exports = {
  apps: [{
    name: 'musicapp',
    script: 'npx',
    args: 'tsx server/index.ts',
    cwd: __dirname + '/..',
    env: {
      NODE_ENV: 'production',
      PORT: '4000',
      BASE_URL: 'https://musicvantage.it',
      DATABASE_URL: '',
    },
    env_file: __dirname + '/../.env',
    max_restarts: 10,
    restart_delay: 3000,
    exp_backoff_restart_delay: 100,
    max_memory_restart: '500M',
    error_file: __dirname + '/../logs/error.log',
    out_file: __dirname + '/../logs/out.log',
    merge_logs: true,
    time: true,
  }]
};
