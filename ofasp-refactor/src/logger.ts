const LOG_LEVELS = ['T', 'D', 'I', 'W', 'E'] as const;
type LogLevel = typeof LOG_LEVELS[number];

interface AspConfig {
  LOG_LVL: LogLevel;
  LOG_DIR: string;
}

let config: AspConfig = {
  LOG_LVL: 'T',
  LOG_DIR: '/data', 
};

export function reloadConfig() {
  try {
    const raw = localStorage.getItem('asp.conf');
    if (raw) {
      const parsed = JSON.parse(raw);
      config = { ...config, ...parsed };
      console.log('[logger] config loaded:', config);
    }
  } catch (err) {
    console.warn('[logger] Failed to parse asp.conf');
  }
}

function now(): string {
  const d = new Date();
  return `${d.getFullYear()}:${String(d.getMonth() + 1).padStart(2, '0')}:${String(d.getDate()).padStart(2, '0')}:${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function log(
  level: LogLevel,
  source: string,
  func: string,
  message: string
) {
  const currentLevelIndex = LOG_LEVELS.indexOf(config.LOG_LVL);
  const thisLevelIndex = LOG_LEVELS.indexOf(level);

  if (thisLevelIndex >= currentLevelIndex) {
    const logLine = `[${now()}] [${level}] [${source}] [${func}] ${message}`;
    console.log(logLine);
  }
}

