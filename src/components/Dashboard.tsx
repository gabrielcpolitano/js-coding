import React from 'react';
import { motion } from 'motion/react';
import { Trophy } from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { cn } from '../utils/cn';

interface DashboardProps {
  xp: number;
  weeklyXp: any[];
}

export const Dashboard: React.FC<DashboardProps> = ({ xp, weeklyXp }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <Trophy className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">Seu Desempenho</h2>
              <p className="text-zinc-500 text-sm">Progresso de XP nos últimos 7 dias</p>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {xp} <span className="text-emerald-500 text-sm font-bold uppercase tracking-widest">XP Total</span>
            </div>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter mt-1">Nível de Maestria Atual</p>
          </div>
        </div>

        <div className="h-[250px] md:h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyXp} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" opacity={0.5} />
              <XAxis 
                dataKey="fullDate" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#71717a', fontSize: 12, fontWeight: 600 }}
                dy={15}
                tickFormatter={(value, index) => weeklyXp[index]?.dayLabel || ''}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#71717a', fontSize: 12 }}
                tickCount={6}
              />
              <Tooltip 
                labelFormatter={(value, payload) => payload[0]?.payload?.displayDate || value}
                contentStyle={{ 
                  backgroundColor: '#09090b', 
                  border: '1px solid #27272a',
                  borderRadius: '12px',
                  fontSize: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
                itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '5 5' }}
                labelStyle={{ color: '#71717a', marginBottom: '4px' }}
              />
              <Area 
                type="monotone" 
                dataKey="xp" 
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorXp)"
                dot={{ fill: '#ffffff', stroke: '#10b981', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 8, fill: '#ffffff', stroke: '#10b981', strokeWidth: 3 }}
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-12 grid grid-cols-7 gap-2 md:gap-4 pt-8 border-t border-zinc-800/50">
          {weeklyXp.map((day, i) => (
            <div key={i} className="flex flex-col items-center gap-2 md:gap-3">
              <div className={cn(
                "w-2 h-2 md:w-3 md:h-3 rounded-full transition-all duration-500",
                day.xp > 0 ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)] scale-110" : "bg-zinc-800"
              )} />
              <div className="flex flex-col items-center">
                <span className="text-[10px] md:text-xs text-white font-bold">{day.xp}</span>
                <span className="text-[8px] md:text-[10px] text-zinc-500 font-black uppercase tracking-tighter">{day.dayLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
