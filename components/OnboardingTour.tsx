import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Organization } from '../types';
import { db } from '../lib/supabase';
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  CheckCircle2, 
  Building2, 
  Users2, 
  Settings2, 
  Zap,
  LayoutDashboard
} from 'lucide-react';

interface OnboardingTourProps {
  currentOrg: Organization;
  onComplete: () => void;
}

interface Step {
  title: string;
  description: string;
  icon: React.ReactNode;
  target?: string; // CSS selector to highlight (optional for now, we'll use a modal-style tour)
}

const steps: Step[] = [
  {
    title: 'Добро пожаловать в WorkTracker Pro!',
    description: 'Мы поможем вам настроить систему для эффективного учета рабочего времени. Это займет всего пару минут.',
    icon: <Zap className="w-12 h-12 text-yellow-500" />,
  },
  {
    title: 'Управление филиалами',
    description: 'В разделе "Филиалы" вы можете добавить все ваши рабочие точки. Для каждой точки можно настроить геозону, чтобы сотрудники могли отмечаться только на месте.',
    icon: <Building2 className="w-12 h-12 text-blue-500" />,
  },
  {
    title: 'Ваша команда',
    description: 'Добавьте сотрудников в соответствующем разделе. Каждому сотруднику будет присвоен уникальный PIN-код для входа в систему.',
    icon: <Users2 className="w-12 h-12 text-indigo-500" />,
  },
  {
    title: 'Настройка системы',
    description: 'В "Настройках" вы можете включить уведомления в Telegram, настроить правила округления времени и выбрать тему оформления.',
    icon: <Settings2 className="w-12 h-12 text-slate-500" />,
  },
  {
    title: 'Панель управления',
    description: 'На главном дашборде вы всегда увидите, кто сейчас на смене, а также общую статистику за день и месяц.',
    icon: <LayoutDashboard className="w-12 h-12 text-emerald-500" />,
  },
  {
    title: 'Все готово!',
    description: 'Теперь вы можете приступать к работе. Если возникнут вопросы, наша поддержка всегда на связи в боковом меню.',
    icon: <CheckCircle2 className="w-12 h-12 text-green-500" />,
  }
];

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ currentOrg, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    // Show tour if not completed
    if (!currentOrg.onboardingCompleted) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [currentOrg.onboardingCompleted]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsVisible(false);
    await db.updateOrganization(currentOrg.id, { onboardingCompleted: true });
    onComplete();
  };

  const handleSkip = async () => {
    if (dontShowAgain) {
      await db.updateOrganization(currentOrg.id, { onboardingCompleted: true });
      onComplete();
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative"
      >
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100 dark:bg-slate-800">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-blue-600"
          />
        </div>

        <button 
          onClick={handleSkip}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-10 pt-12 text-center">
          <motion.div 
            key={currentStep}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-8"
          >
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem]">
              {step.icon}
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 mb-4 leading-tight">
                {step.title}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed mb-10">
                {step.description}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-center">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all"
                />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                  Больше не показывать
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-4">
              <button
                onClick={handlePrev}
                disabled={currentStep === 0}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
                  currentStep === 0 
                    ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Назад
              </button>

              <div className="flex gap-1.5">
                {steps.map((_, idx) => (
                  <div 
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentStep ? 'w-6 bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-black shadow-lg shadow-blue-600/20 transition-all active:scale-95"
              >
                {currentStep === steps.length - 1 ? 'Начать работу' : 'Далее'}
                {currentStep !== steps.length - 1 && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
