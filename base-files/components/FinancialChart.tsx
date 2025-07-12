import React from 'react';
export function FinancialChart() {
  // This would typically use a charting library like recharts
  // Here we're creating a simple SVG chart for visualization
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const incomeData = [4500, 5200, 4800, 6000, 5700, 6200, 7000, 6800, 7500, 7200, 8000, 8500];
  const expenseData = [3800, 4100, 3900, 4500, 4300, 4800, 5200, 5000, 5500, 5300, 5800, 6000];
  // Calculate the max value for scaling
  const maxValue = Math.max(...incomeData, ...expenseData);
  // Scale factor for the chart
  const scaleY = (value: number) => 100 - value / maxValue * 80;
  return <section className="mt-12 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Ingresos vs Egresos del Año</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span className="text-sm text-gray-300">Ingresos</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-rose-500 mr-2"></div>
            <span className="text-sm text-gray-300">Egresos</span>
          </div>
        </div>
      </div>
      <div className="h-64 w-full">
        <svg className="w-full h-full" viewBox="0 0 1200 400" preserveAspectRatio="none">
          {/* Grid lines */}
          <g className="text-white/10">
            {[0, 1, 2, 3, 4].map(i => <line key={`grid-${i}`} x1="50" y1={100 + i * 60} x2="1150" y2={100 + i * 60} stroke="currentColor" strokeDasharray="5,5" />)}
          </g>
          {/* Y-axis labels */}
          <g className="text-xs text-gray-400 fill-current">
            {[0, 1, 2, 3, 4].map(i => <text key={`y-label-${i}`} x="40" y={104 + i * 60} textAnchor="end">
                ${Math.round((maxValue - i * (maxValue / 4)) / 1000)}k
              </text>)}
          </g>
          {/* X-axis labels */}
          <g className="text-xs text-gray-400 fill-current">
            {months.map((month, i) => <text key={`x-label-${i}`} x={100 + i * 90} y="340" textAnchor="middle">
                {month}
              </text>)}
          </g>
          {/* Income line */}
          <path d={`M100,${scaleY(incomeData[0])} ${incomeData.map((d, i) => `L${100 + i * 90},${scaleY(d)}`).join(' ')}`} fill="none" stroke="url(#blue-gradient)" strokeWidth="3" strokeLinecap="round" />
          {/* Expense line */}
          <path d={`M100,${scaleY(expenseData[0])} ${expenseData.map((d, i) => `L${100 + i * 90},${scaleY(d)}`).join(' ')}`} fill="none" stroke="url(#rose-gradient)" strokeWidth="3" strokeLinecap="round" />
          {/* Gradients */}
          <defs>
            <linearGradient id="blue-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="rose-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
          </defs>
          {/* Data points - Income */}
          {incomeData.map((d, i) => <circle key={`income-point-${i}`} cx={100 + i * 90} cy={scaleY(d)} r="4" fill="#3b82f6" />)}
          {/* Data points - Expense */}
          {expenseData.map((d, i) => <circle key={`expense-point-${i}`} cx={100 + i * 90} cy={scaleY(d)} r="4" fill="#f43f5e" />)}
        </svg>
      </div>
    </section>;
}