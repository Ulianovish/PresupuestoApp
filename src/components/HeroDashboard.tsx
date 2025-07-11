import React from 'react';
import { TrendingUpIcon, TrendingDownIcon, WalletIcon } from 'lucide-react';
export function HeroDashboard() {
  return <section className="py-8">
      <h2 className="sr-only">Dashboard financiero</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Ingresos mes actual" amount="$8,540.50" trend="+12.3%" icon={<TrendingUpIcon className="h-6 w-6 text-emerald-400" />} sparklineData={[3, 7, 5, 9, 6, 8, 10]} sparklineColor="emerald" />
        <MetricCard title="Gastos mes actual" amount="$5,230.80" trend="-3.6%" icon={<TrendingDownIcon className="h-6 w-6 text-rose-400" />} sparklineData={[8, 5, 7, 4, 6, 5, 3]} sparklineColor="rose" />
        <MetricCard title="Patrimonio neto" amount="$142,568.30" trend="+5.2%" icon={<WalletIcon className="h-6 w-6 text-blue-400" />} sparklineData={[5, 8, 7, 9, 11, 10, 12]} sparklineColor="blue" />
      </div>
    </section>;
}
function MetricCard({
  title,
  amount,
  trend,
  icon,
  sparklineData,
  sparklineColor
}: {
  title: string;
  amount: string;
  trend: string;
  icon: React.ReactNode;
  sparklineData: number[];
  sparklineColor: 'emerald' | 'rose' | 'blue';
}) {
  const colorMap = {
    emerald: 'from-emerald-500 to-teal-600',
    rose: 'from-rose-500 to-pink-600',
    blue: 'from-blue-500 to-indigo-600'
  };
  const gradientClass = colorMap[sparklineColor];
  return <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:translate-y-[-2px]">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-gray-300">{title}</h3>
          <div className="mt-2 flex items-baseline">
            <p className="text-2xl font-semibold">{amount}</p>
            <p className={`ml-2 text-sm font-medium ${trend.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
              {trend}
            </p>
          </div>
        </div>
        <div className="p-2 bg-white/5 rounded-lg">{icon}</div>
      </div>
      <div className="mt-4 h-10">
        <svg className="w-full h-full" viewBox="0 0 100 30">
          <defs>
            <linearGradient id={`gradient-${sparklineColor}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" className={`text-${sparklineColor}-500`} stopColor="currentColor" />
              <stop offset="100%" className={`text-${sparklineColor}-600`} stopColor="currentColor" />
            </linearGradient>
          </defs>
          {sparklineData.length > 1 && <>
              <path d={`M0,${30 - sparklineData[0] * 2} ${sparklineData.map((d, i) => `L${(i + 1) * (100 / (sparklineData.length - 1))},${30 - d * 2}`).join(' ')}`} fill="none" stroke={`url(#gradient-${sparklineColor})`} strokeWidth="2" strokeLinecap="round" />
              {sparklineData.map((d, i) => <circle key={i} cx={i * (100 / (sparklineData.length - 1))} cy={30 - d * 2} r="1" className={`text-${sparklineColor}-400`} fill="currentColor" />)}
            </>}
        </svg>
      </div>
    </div>;
}