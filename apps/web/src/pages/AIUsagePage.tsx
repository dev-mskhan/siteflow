import { useState } from 'react';
import { Activity, ArrowUpRight, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { AIUsageWidget } from '@/components/ai/AIUsageWidget';
import { AIUsageChart } from '@/components/ai/AIUsageChart';
import { useOrgContext } from '@/features/org/useOrgContext';

type TimeRange = 7 | 30 | 90;

export function AIUsagePage() {
  const { org } = useOrgContext();
  const [timeRange, setTimeRange] = useState<TimeRange>(30);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Usage</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Monitor your AI token consumption and billing limits
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Info Banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-blue-200 bg-blue-50 p-4"
          >
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">About AI token usage</p>
                <p className="mt-1">
                  Tokens measure AI processing. Each agent run consumes tokens based on input/output
                  length. Your monthly limit resets at the start of each billing cycle.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Usage Widget */}
          <AIUsageWidget />

          {/* Chart Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Usage History</h2>

              {/* Time Range Selector */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setTimeRange(days as TimeRange)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      timeRange === days
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            </div>

            <AIUsageChart days={timeRange} />
          </div>

          {/* Upgrade CTA (shown when approaching limit) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-lg border border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50 p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Need more AI capacity?</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Upgrade your plan to get higher token limits and unlock advanced features.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span>Pro: 500k tokens/month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                    <span>Enterprise: 2M tokens/month + custom limits</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => {
                  // Navigate to billing/upgrade page
                  if (org?.id) {
                    window.location.href = `/org/${org.id}/settings/billing`;
                  }
                }}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Upgrade Plan
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
