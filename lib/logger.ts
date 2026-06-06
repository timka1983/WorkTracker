export const SystemLogger = {
  log: (action: string, details: string, error?: any) => {
    try {
      const logs = JSON.parse(localStorage.getItem('system_logs') || '[]');
      const newLog = {
        timestamp: new Date().toISOString(),
        action,
        details,
        error: error ? (error.message || JSON.stringify(error)) : null
      };
      
      logs.unshift(newLog);
      // Keep only last 500 logs to prevent overflow
      if (logs.length > 500) {
        logs.pop();
      }
      
      localStorage.setItem('system_logs', JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to write to system logs', e);
    }
  },
  
  getLogs: () => {
    try {
      return JSON.parse(localStorage.getItem('system_logs') || '[]');
    } catch (e) {
      return [];
    }
  },

  clearLogs: () => {
    localStorage.removeItem('system_logs');
  },

  downloadLogs: () => {
    try {
      const logs = SystemLogger.getLogs();
      const text = logs.map((l: any) => 
        `[${l.timestamp}] ${l.action} - ${l.details}${l.error ? ` ERROR: ${l.error}` : ''}`
      ).join('\n');
      
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system_logs_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download logs', e);
    }
  }
};
