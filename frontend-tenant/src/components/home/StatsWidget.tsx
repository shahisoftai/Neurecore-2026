'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassPanel } from './GlassPanel';

interface StatPoint {
    name: string;
    value: number;
    timestamp: string;
}

const mockData: StatPoint[] = [
    { name: 'Mon', value: 65, timestamp: 'Monday' },
    { name: 'Tue', value: 78, timestamp: 'Tuesday' },
    { name: 'Wed', value: 72, timestamp: 'Wednesday' },
    { name: 'Thu', value: 85, timestamp: 'Thursday' },
    { name: 'Fri', value: 92, timestamp: 'Friday' },
    { name: 'Sat', value: 88, timestamp: 'Saturday' },
    { name: 'Sun', value: 95, timestamp: 'Sunday' },
];

export function StatsWidget() {
    const [data, setData] = useState<StatPoint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate loading stats
        setTimeout(() => {
            setData(mockData);
            setLoading(false);
        }, 300);

        // Real-time updates would go here
    }, []);

    if (loading) {
        return (
            <GlassPanel className="p-6">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-400 animate-pulse" />
                    <p className="text-zinc-400">Loading stats...</p>
                </div>
            </GlassPanel>
        );
    }

    return (
        <GlassPanel className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">Performance</h3>
                </div>
                <div className="flex items-center gap-1 text-green-400 text-sm font-medium">
                    <TrendingUp className="w-4 h-4" />
                    +12.5%
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" />
                        <YAxis stroke="rgba(255,255,255,0.3)" />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(0,0,0,0.8)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '8px',
                            }}
                            cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#a78bfa"
                            dot={{ fill: '#c4b5fd', r: 4 }}
                            activeDot={{ r: 6 }}
                            strokeWidth={2}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </GlassPanel>
    );
}
