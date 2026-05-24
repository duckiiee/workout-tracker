import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CHART, CHART_LEGEND_STYLE, CHART_TOOLTIP_STYLE } from '../constants/chartTheme';

import { API_BASE } from '../config/api';

function isCompleted(value) {
  return value === true || value === 1;
}

function formatMonth(monthStr) {
  const [year, month] = monthStr.split('-');
  return format(new Date(Number(year), Number(month) - 1, 1), 'MM/yyyy', { locale: vi });
}

function formatWeightDate(dateStr) {
  const iso = dateStr?.includes?.('T') ? dateStr : `${dateStr}T00:00:00`;
  return format(new Date(iso), 'dd/MM', { locale: vi });
}

function StatCard({ label, value, sub }) {
  return (
    <article className="stat-card">
      <p className="stat-card-label">{label}</p>
      <p className="stat-card-value">{value}</p>
      {sub && <p className="stat-card-sub">{sub}</p>}
    </article>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <section className="glass-card">
      <h2 className="card-title">{title}</h2>
      {subtitle && <p className="card-subtitle">{subtitle}</p>}
      <div className="mt-6 h-72">{children}</div>
    </section>
  );
}

export default function Statistics() {
  const [stats, setStats] = useState(null);
  const [completedWorkoutCount, setCompletedWorkoutCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStatistics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [statsResponse, workoutsResponse] = await Promise.all([
        fetch(`${API_BASE}/statistics`),
        fetch(`${API_BASE}/workouts`),
      ]);

      const statsResult = await statsResponse.json();
      const workoutsResult = await workoutsResponse.json();

      if (!statsResponse.ok || !statsResult.success) {
        throw new Error(statsResult.message || 'Không thể tải thống kê.');
      }

      setStats(statsResult.data);

      if (workoutsResponse.ok && workoutsResult.success) {
        const completed = workoutsResult.data.filter((w) => isCompleted(w.IsCompleted)).length;
        setCompletedWorkoutCount(completed);
      } else {
        setCompletedWorkoutCount(0);
      }
    } catch (err) {
      setError(err.message || 'Không thể tải thống kê.');
      setStats(null);
      setCompletedWorkoutCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  const monthlyChart = useMemo(() => {
    if (!stats?.workoutsByMonth) return [];
    return stats.workoutsByMonth.map((row) => ({
      month: formatMonth(row.Month),
      total: row.Total,
      completed: row.Completed,
    }));
  }, [stats]);

  const weightChart = useMemo(() => {
    if (!stats?.weightHistory) return [];
    return stats.weightHistory.map((row) => ({
      label: formatWeightDate(row.RecordDate),
      weight: Number(row.Weight),
    }));
  }, [stats]);

  const topExerciseChart = useMemo(() => {
    if (!stats?.topExercises) return [];
    return stats.topExercises.map((row) => ({
      name: row.Name.length > 14 ? `${row.Name.slice(0, 14)}…` : row.Name,
      usage: row.UsageCount,
      volume: Math.round(row.TotalVolumeKg),
    }));
  }, [stats]);

  if (loading) {
    return (
      <div className="loading-screen">
        <span className="spinner" />
        Đang tải thống kê...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div role="alert" className="alert-error">
          {error}
        </div>
        <button type="button" onClick={loadStatistics} className="btn-primary">
          Thử lại
        </button>
      </div>
    );
  }

  const summary = stats?.summary;

  return (
    <div className="page-shell">
      <header>
        <p className="page-kicker">Thống kê</p>
        <h1 className="page-title">Phân tích tập luyện</h1>
        <p className="page-desc">
          Tổng quan khối lượng, buổi tập và xu hướng cân nặng.
        </p>
      </header>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Số buổi đã tập"
          value={completedWorkoutCount}
          sub="Tổng buổi đã hoàn thành"
        />
        <StatCard
          label="Tổng buổi tập"
          value={summary?.totalWorkouts ?? 0}
          sub={`${summary?.completedWorkouts ?? 0} buổi hoàn thành`}
        />
        <StatCard
          label="Tỷ lệ hoàn thành"
          value={`${summary?.completionRate ?? 0}%`}
          sub="Trên tổng số buổi"
        />
        <StatCard
          label="Tổng khối lượng"
          value={`${(summary?.totalVolumeKg ?? 0).toLocaleString('vi-VN')} kg`}
          sub={`${summary?.totalSets ?? 0} set ghi nhận`}
        />
        <StatCard
          label="Bài tập trong thư viện"
          value={summary?.totalExercises ?? 0}
          sub="Số bài trong Exercises"
        />
      </section>

      <section className="grid gap-8 xl:grid-cols-2">
        <ChartCard title="Buổi tập theo tháng" subtitle="Tổng số vs đã hoàn thành">
          {monthlyChart.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm font-medium text-gray-500">
              Chưa có dữ liệu buổi tập.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: CHART.tick, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART.tick, fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                <Bar dataKey="total" name="Tổng" fill={CHART.sky} radius={[8, 8, 0, 0]} />
                <Bar
                  dataKey="completed"
                  name="Hoàn thành"
                  fill={CHART.mint}
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Xu hướng cân nặng" subtitle="BodyWeightHistory">
          {weightChart.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm font-medium text-gray-500">
              Chưa có dữ liệu cân nặng.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChart}>
                <defs>
                  <linearGradient id="statsWeightGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={CHART.blue} />
                    <stop offset="100%" stopColor={CHART.violet} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: CHART.tick, fontSize: 11 }} />
                <YAxis
                  unit=" kg"
                  tick={{ fill: CHART.tick, fontSize: 11 }}
                  domain={['dataMin - 2', 'dataMax + 2']}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="weight"
                  name="Cân nặng"
                  stroke="url(#statsWeightGradient)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: CHART.coral }}
                  activeDot={{ r: 6, fill: CHART.coral, stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      <ChartCard title="Bài tập được dùng nhiều nhất" subtitle="Top 8 theo số lần xuất hiện">
        {topExerciseChart.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm font-medium text-gray-500">
            Chưa có chi tiết bài tập trong WorkoutDetails.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topExerciseChart} layout="vertical" margin={{ left: 8, right: 16 }}>
              <defs>
                <linearGradient id="usageBarGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={CHART.indigo} />
                  <stop offset="100%" stopColor={CHART.violet} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: CHART.tick, fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fill: CHART.tick, fontSize: 11 }}
              />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar
                dataKey="usage"
                name="Số lần"
                fill="url(#usageBarGradient)"
                radius={[0, 8, 8, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
