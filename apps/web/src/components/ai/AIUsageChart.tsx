import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { useGetAIUsageHistoryQuery } from '@/features/ai/aiUsageApi';
import { useOrgContext } from '@/features/org/useOrgContext';

interface AIUsageChartProps {
  days?: 7 | 30 | 90;
  className?: string;
}

export function AIUsageChart({ days = 30, className = '' }: AIUsageChartProps) {
  const { org } = useOrgContext();

  const startDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }, [days]);

  const endDate = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const {
    data: history,
    isLoading,
    error,
  } = useGetAIUsageHistoryQuery(
    { organizationId: org?.id ?? '', startDate, endDate },
    { skip: !org?.id },
  );

  const chartData = useMemo(() => {
    if (!history?.dailyUsage) return [];

    return history.dailyUsage.map((day) => ({
      date: new Date(day.usageDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      productionTokens: day.productionTokens,
      trialTokens: day.trialTokens,
      totalTokens: day.totalTokens,
    }));
  }, [history]);

  const maxTokens = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.max(...chartData.map((d) => d.totalTokens));
  }, [chartData]);

  if (isLoading) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-40 rounded bg-gray-200" />
          <div className="h-64 w-full rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 p-6 ${className}`}>
        <div className="flex items-center gap-2 text-red-800">
          <Calendar className="h-5 w-5" />
          <span className="text-sm font-medium">Failed to load usage history</span>
        </div>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-6 ${className}`}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-sm font-medium text-gray-900">No usage data yet</p>
          <p className="mt-1 text-xs text-gray-500">Usage will appear here once AI agents run</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Token Usage Trend</h3>
        <p className="mt-1 text-sm text-gray-500">
          Daily token consumption over the last {days} days
        </p>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorProduction" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="colorTrial" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickLine={{ stroke: '#e5e7eb' }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
            formatter={(value: number, name: string) => {
              const label =
                name === 'productionTokens'
                  ? 'Production'
                  : name === 'trialTokens'
                    ? 'Trial'
                    : 'Total';
              return [value.toLocaleString(), label];
            }}
            labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: '4px' }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => {
              if (value === 'productionTokens') return 'Production Tokens';
              if (value === 'trialTokens') return 'Trial Tokens';
              return value;
            }}
          />
          <Area
            type="monotone"
            dataKey="trialTokens"
            stackId="1"
            stroke="#8b5cf6"
            fill="url(#colorTrial)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="productionTokens"
            stackId="1"
            stroke="#3b82f6"
            fill="url(#colorProduction)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      {history && (
        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs text-gray-500">Total Used</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {history.summary.totalTokens.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Production</p>
            <p className="mt-1 text-lg font-semibold text-blue-600">
              {history.summary.productionTokens.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Trial</p>
            <p className="mt-1 text-lg font-semibold text-purple-600">
              {history.summary.trialTokens.toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
