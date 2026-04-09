import React, { useState, useEffect } from 'react';

const LoadingScreen: React.FC = () => {
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowRetry(true);
    }, 10000); // Show retry after 10 seconds
    return () => clearTimeout(timer);
  }, []);

  const handleRetry = () => {
    window.location.href = window.location.pathname;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-6 max-w-md px-6 text-center">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        
        <div className="space-y-2">
          <p className="text-slate-700 font-semibold text-lg">Загрузка системы...</p>
          <p className="text-slate-500 text-sm">Подключаемся к базе данных и проверяем сессию</p>
        </div>

        {showRetry && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-amber-800 text-sm mb-3">
              Загрузка занимает больше времени, чем обычно. Это может быть связано с медленным интернетом или блокировщиком рекламы.
            </p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
            >
              Перезагрузить страницу
            </button>
            <p className="mt-2 text-xs text-slate-400">
              Если проблема сохраняется, проверьте настройки AdBlock или VPN.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
