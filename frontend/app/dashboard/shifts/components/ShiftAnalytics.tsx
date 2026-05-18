'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Target } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Analytics {
  summary: {
    totalShifts: number;
    totalPositions: number;
    totalFilled: number;
    totalOpen: number;
    utilizationRate: number;
  };
  byRole: Array<{
    role: string;
    shifts: number;
    positions: number;
    filled: number;
    open: number;
  }>;
  byFacility: Array<{
    facility: string;
    shifts: number;
    positions: number;
    filled: number;
    open: number;
  }>;
}

interface ShiftAnalyticsProps {
  startDate?: string;
  endDate?: string;
}

export default function ShiftAnalytics({ startDate, endDate }: ShiftAnalyticsProps) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate]);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/shifts/analytics/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const data = await res.json();
      setAnalytics(data.data);
    } catch (error) {
      toast.error('Failed to load analytics');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className="text-center py-12">No data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Shifts</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.summary.totalShifts}</p>
            </div>
            <BarChart3 className="w-10 h-10 text-blue-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Positions Required</p>
              <p className="text-3xl font-bold text-gray-900">{analytics.summary.totalPositions}</p>
            </div>
            <Target className="w-10 h-10 text-yellow-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Positions Filled</p>
              <p className="text-3xl font-bold text-green-600">{analytics.summary.totalFilled}</p>
            </div>
            <Users className="w-10 h-10 text-green-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Utilization Rate</p>
              <p className="text-3xl font-bold text-purple-600">{analytics.summary.utilizationRate}%</p>
            </div>
            <TrendingUp className="w-10 h-10 text-purple-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* By Role */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Shifts by Role</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-sm font-semibold text-gray-600">Role</th>
                <th className="text-right py-2 text-sm font-semibold text-gray-600">Shifts</th>
                <th className="text-right py-2 text-sm font-semibold text-gray-600">Positions</th>
                <th className="text-right py-2 text-sm font-semibold text-gray-600">Filled</th>
                <th className="text-right py-2 text-sm font-semibold text-gray-600">Open</th>
                <th className="text-right py-2 text-sm font-semibold text-gray-600">Fill Rate</th>
              </tr>
            </thead>
            <tbody>
              {analytics.byRole.map((row) => {
                const fillRate = row.positions > 0 ? Math.round((row.filled / row.positions) * 100) : 0;
                return (
                  <tr key={row.role} className="border-b hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{row.role}</td>
                    <td className="text-right text-gray-600">{row.shifts}</td>
                    <td className="text-right text-gray-600">{row.positions}</td>
                    <td className="text-right text-green-600 font-semibold">{row.filled}</td>
                    <td className="text-right text-yellow-600 font-semibold">{row.open}</td>
                    <td className="text-right">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                        {fillRate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* By Facility */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Shifts by Facility</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-sm font-semibold text-gray-600">Facility</th>
                <th className="text-right py-2 text-sm font-semibold text-gray-600">Shifts</th>
                <th className="text-right py-2 text-sm font-semibold text-gray-600">Positions</th>
                <th className="text-right py-2 text-sm font-semibold text-gray-600">Filled</th>
                <th className="text-right py-2 text-sm font-semibold text-gray-600">Open</th>
                <th className="text-right py-2 text-sm font-semibold text-gray-600">Fill Rate</th>
              </tr>
            </thead>
            <tbody>
              {analytics.byFacility.map((row) => {
                const fillRate = row.positions > 0 ? Math.round((row.filled / row.positions) * 100) : 0;
                return (
                  <tr key={row.facility} className="border-b hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{row.facility}</td>
                    <td className="text-right text-gray-600">{row.shifts}</td>
                    <td className="text-right text-gray-600">{row.positions}</td>
                    <td className="text-right text-green-600 font-semibold">{row.filled}</td>
                    <td className="text-right text-yellow-600 font-semibold">{row.open}</td>
                    <td className="text-right">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                        {fillRate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
