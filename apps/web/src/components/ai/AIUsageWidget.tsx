import { AlertCircle, TrendingUp, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useGetCurrentAIUsageQuery } from '@/features/ai/aiUsageApi';
import { useOrgContext } from '@/features/org/useOrgContext';

interface AIUsageWidgetProps {
  className?: string;
}

export function AIUsageWidget({ className = '' }: AIUsageWidgetProps) {
  const { org } = useOrgContext();
  const {
    data: usage,
    isLoading,
    error,
  } = useGetCurrentAIUsageQuery(org?.id ?? '', { skip: !org?.id, pollingInterval: 30000 });

  if (isLoading) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-gray-200" />
          <div className="h-2 w-full rounded bg-gray-200" />
          <div className="h-4 w-24 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 p-6 ${className}`}>
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Failed to load AI usage</span>
        </div>
      </div>
    );
  }

  const percentUsed = (usage.tokensUsed / usage.tokenLimit) * 100;
  const isNearLimit = percentUsed >= 80;
  const isAtLimit = percentUsed >= 100;

  const getProgressColor = () => {
    if (isAtLimit) return 'bg-red-500';
    if (isNearLimit) return 'bg-amber-500';
    return 'bg-blue-500';
  };

  const getStatusColor = () => {
    if (isAtLimit) return 'text-red-700 bg-red-100';
    if (isNearLimit) return 'text-amber-700 bg-amber-100';
    return 'text-blue-700 bg-blue-100';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-500">AI Usage This Month</h3>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {usage.tokensUsed.toLocaleString()}
            <span className="ml-1 text-base font-normal text-gray-500">
              / {usage.tokenLimit.toLocaleString()} tokens
            </span>
          </p>
        </div>
        <div className={`rounded-lg p-2 ${getStatusColor()}`}>
          <Zap className="h-5 w-5" />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentUsed, 100)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full ${getProgressColor()}`}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
          <span>{percentUsed.toFixed(1)}% used</span>
          <span>{(usage.tokenLimit - usage.tokensUsed).toLocaleString()} remaining</span>
        </div>
      </div>

      {/* Status Messages */}
      {isAtLimit && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-3"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
            <div className="text-sm text-red-800">
              <p className="font-medium">Usage limit reached</p>
              <p className="mt-1 text-xs">
                AI features are paused. Upgrade your plan to continue using AI agents.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {isNearLimit && !isAtLimit && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3"
        >
          <div className="flex items-start gap-2">
            <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Approaching usage limit</p>
              <p className="mt-1 text-xs">Consider upgrading to avoid interruption.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Plan Info */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-600">
        <span>Plan: {usage.planName}</span>
        <span>
          Resets{' '}
          {new Date(usage.periodEnd).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </motion.div>
  );
}
