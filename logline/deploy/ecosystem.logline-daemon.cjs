module.exports = {
  apps: [
    {
      name: 'logline-daemon',
      cwd: '/Users/ubl-ops/UBLX App/logline',
      script: '/Users/ubl-ops/UBLX App/logline/scripts/run-logline-daemon.sh',
      interpreter: 'bash',
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 2000,
      out_file: '/Users/ubl-ops/UBLX App/logline/deploy/logline-daemon.out.log',
      error_file: '/Users/ubl-ops/UBLX App/logline/deploy/logline-daemon.err.log',
      merge_logs: true,
      time: true,
      env: {
        RUST_LOG: 'info',
      },
    },
  ],
};
