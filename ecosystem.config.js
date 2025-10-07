/**
 * Configuración de PM2 para modo cluster en t3.2xlarge
 * 8 vCPUs, 32GB RAM - COMPARTIDO con MySQL y otros servicios
 * 
 * DISTRIBUCIÓN EN HORARIO PICO:
 * - MySQL:          12GB (buffer pool + overhead)
 * - Otros servicios: 4GB  (papayz-rtm-api, blog, etc)
 * - Sistema:         2GB  (OS overhead)
 * - Node.js PWA:    12GB  (5 workers × 2.4GB)
 * - Reserva:         2GB  (seguridad)
 * TOTAL:            32GB
 * 
 * Documentación: https://pm2.keymetrics.io/docs/usage/cluster-mode/
 */

module.exports = {
  apps: [{
    // Información básica
    name: 'pwa',              // Mismo nombre que usas actualmente
    script: './app.js',
    
    // ⭐ CLUSTER MODE - Conservador para servidor compartido
    instances: 4,              // 4 instancias (50 % de 8 vCPUs - SEGURO)
    exec_mode: 'cluster',      // Modo cluster (vs 'fork')
    
    // Gestión de memoria conservadora (12GB / 5 workers = 2.4GB por worker)
    max_memory_restart: '2400M',  // Reinicia si excede 2.4GB
    
    // Node.js arguments
    node_args: [
      '--max-old-space-size=2304',  // Heap de 2.25GB por worker (deja margen)
      '--max-semi-space-size=128',  // Optimización GC
    ],
    
    // Variables de entorno
    env: {
      NODE_ENV: 'production',      
    },
    
    env_development: {
      NODE_ENV: 'development',      
    },
    
    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,           // Combina logs de todos los workers
    
    // Gestión de procesos
    watch: false,               // No reiniciar en cambios (producción)
    ignore_watch: ['node_modules', 'logs'],
    
    // Reinicio inteligente
    min_uptime: '10s',          // Considera "online" después de 10s
    max_restarts: 10,           // Máximo 10 reintentos
    autorestart: true,          // Reiniciar automáticamente
    
    // Graceful shutdown
    kill_timeout: 5000,         // Espera 5s antes de forzar cierre
    wait_ready: true,           // Espera señal de "ready" de la app
    listen_timeout: 10000,      // Timeout para escuchar puerto
    
    // Cluster específico
    instance_var: 'INSTANCE_ID', // Variable de entorno con ID del worker
  }]
};
