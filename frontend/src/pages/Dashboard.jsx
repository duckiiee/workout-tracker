import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CHART, CHART_TOOLTIP_STYLE } from '../constants/chartTheme';

const API_BASE = 'http://localhost:5000/api';

function calcBmi(weightKg, heightCm) {
  if (weightKg == null || heightCm == null || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

function bmiLabel(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return 'Thiếu cân';
  if (bmi < 25) return 'Bình thường';
  if (bmi < 30) return 'Thừa cân';
  return 'Béo phì';
}

function formatChartDate(dateStr) {
  const iso = dateStr?.includes?.('T') ? dateStr : `${dateStr}T00:00:00`;
  return format(new Date(iso), 'dd/MM', { locale: vi });
}

function isCompleted(value) {
  return value === true || value === 1;
}

function formatExerciseSummary(detail) {
  return `${detail.ExerciseName} — ${detail.Sets} sets × ${detail.Reps} reps — ${Number(detail.Weight)} kg`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Yêu cầu thất bại.');
  }
  return result.data;
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

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 shadow-lg backdrop-blur-md"
      style={CHART_TOOLTIP_STYLE}
    >
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm font-semibold" style={{ color: CHART.sky }}>
        {payload[0].value} kg
      </p>
    </div>
  );
}

export default function Dashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const [profile, setProfile] = useState(null);
  const [weightHistory, setWeightHistory] = useState([]);
  const [todayDetails, setTodayDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const errors = [];

    const [profileResult, weightResult, todayDetailsResult] = await Promise.allSettled([
      fetch(`${API_BASE}/profile`).then((r) => r.json()),
      fetchJson(`${API_BASE}/weight`),
      fetchJson(`${API_BASE}/workouts/today-details`),
    ]);

    if (profileResult.status === 'fulfilled' && profileResult.value?.success) {
      setProfile(profileResult.value.data);
    } else {
      setProfile(null);
    }

    if (weightResult.status === 'fulfilled') {
      setWeightHistory(weightResult.value);
    } else {
      setWeightHistory([]);
      errors.push('Không tải được lịch sử cân nặng.');
    }

    if (todayDetailsResult.status === 'fulfilled') {
      setTodayDetails(todayDetailsResult.value);
    } else {
      setTodayDetails([]);
      errors.push('Không tải được lịch tập hôm nay.');
    }

    if (errors.length > 0) {
      setError(errors.join(' '));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const latestWeight = weightHistory.length > 0 ? Number(weightHistory[0].Weight) : null;
  const heightCm = profile?.Height != null ? Number(profile.Height) : null;
  const bmi = useMemo(() => calcBmi(latestWeight, heightCm), [latestWeight, heightCm]);
  const bmiCategory = bmiLabel(bmi);

  const chartData = useMemo(() => {
    return [...weightHistory]
      .sort((a, b) => new Date(a.RecordDate) - new Date(b.RecordDate))
      .map((row) => ({
        label: formatChartDate(row.RecordDate),
        weight: Number(row.Weight),
      }));
  }, [weightHistory]);

  const todayLabel = format(new Date(), "EEEE, dd/MM/yyyy", { locale: vi });
  const completedToday = todayDetails.filter((d) => isCompleted(d.IsCompleted)).length;
  const totalToday = todayDetails.length;
  const progressPercent = totalToday > 0 ? (completedToday / totalToday) * 100 : 0;

  const weightDelta =
    chartData.length >= 2 ? chartData.at(-1).weight - chartData[0].weight : null;

  async function toggleDetailComplete(detail) {
    if (updatingId) return;

    const nextCompleted = !isCompleted(detail.IsCompleted);
    setUpdatingId(detail.DetailID);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/workout-details/${detail.DetailID}/complete`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ IsCompleted: nextCompleted }),
        }
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể cập nhật trạng thái bài tập.');
      }

      const updated = result.data;
      setTodayDetails((prev) =>
        prev.map((d) => (d.DetailID === updated.DetailID ? { ...d, ...updated } : d))
      );
    } catch (err) {
      setError(err.message || 'Không thể cập nhật trạng thái bài tập.');
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <span className="spinner" />
        Đang tải dashboard...
      </div>
    );
  }

  return (
    <div className="page-shell">
      <header>
        <p className="page-kicker">Tập để khỏe mạnh hơn</p>
        <h1 className="page-title">Tổng quan hôm nay</h1>
        <p className="page-desc capitalize">{todayLabel}</p>
      </header>

      {error && (
        <div role="alert" className="alert-error">
          {error}
        </div>
      )}

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Cân nặng hiện tại"
          value={latestWeight != null ? `${latestWeight} kg` : 'N/A'}
          sub={
            weightHistory.length > 0
              ? `Cập nhật ${formatChartDate(weightHistory[0].RecordDate)}`
              : 'Chưa có dữ liệu cân nặng'
          }
        />
        <StatCard
          label="Chiều cao"
          value={heightCm != null ? `${heightCm} cm` : 'N/A'}
          sub={heightCm != null ? 'Từ hồ sơ cá nhân' : 'Cập nhật tại trang Hồ sơ'}
        />
        <StatCard
          label="Chỉ số BMI"
          value={bmi != null ? bmi : 'N/A'}
          sub={bmiCategory ?? 'Cần cân nặng & chiều cao'}
        />
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="apple-card">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h2 className="card-title">Lịch tập hôm nay</h2>
              <p className="card-subtitle">
                {completedToday}/{totalToday} bài tập hoàn thành
              </p>
            </div>
            <span className="badge-pill">{today}</span>
          </div>

          {totalToday === 0 ? (
            <p className="empty-state">
              Chưa có bài tập nào hôm nay.
            </p>
          ) : (
            <ul className="space-y-3">
              {todayDetails.map((detail) => {
                const done = isCompleted(detail.IsCompleted);
                const isUpdating = updatingId === detail.DetailID;

                return (
                  <li key={detail.DetailID}>
                    <label
                      className={`flex cursor-pointer items-center gap-4 rounded-2xl border px-5 py-4 transition ${
                        done ? 'item-done' : 'item-pending'
                      } ${isUpdating ? 'pointer-events-none opacity-60' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={done}
                        disabled={isUpdating}
                        onChange={() => toggleDetailComplete(detail)}
                        className="h-5 w-5 shrink-0 rounded border-gray-300 text-black focus:ring-black focus:ring-offset-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-medium ${done ? 'text-gray-500 line-through decoration-gray-400' : 'text-gray-900'}`}
                        >
                          {formatExerciseSummary(detail)}
                        </p>
                        {detail.MuscleGroup && (
                          <p className="text-sm text-gray-500">{detail.MuscleGroup}</p>
                        )}
                      </div>
                      {isUpdating ? (
                        <span className="spinner h-4 w-4 shrink-0" />
                      ) : (
                        done && (
                          <span className="shrink-0 text-xs font-semibold uppercase text-gray-600">
                            Xong
                          </span>
                        )
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {totalToday > 0 && (
            <div className="progress-track mt-6">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          )}
        </div>

        <div className="apple-card">
          <div className="mb-6">
            <h2 className="card-title">Tiến độ cân nặng</h2>
            <p className="card-subtitle">Lịch sử từ BodyWeightHistory</p>
          </div>

          {chartData.length === 0 ? (
            <p className="flex h-72 items-center justify-center text-sm text-gray-500 sm:h-80">
              Chưa có dữ liệu cân nặng.
            </p>
          ) : (
            <>
              <div className="h-72 w-full sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="weightLineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={CHART.sky} />
                        <stop offset="100%" stopColor={CHART.indigo} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: CHART.tick, fontSize: 11 }}
                      axisLine={{ stroke: CHART.axis }}
                      tickLine={false}
                    />
                    <YAxis
                      unit=" kg"
                      tick={{ fill: CHART.tick, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      domain={['dataMin - 2', 'dataMax + 2']}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="url(#weightLineGradient)"
                      strokeWidth={3}
                      dot={{ fill: CHART.mint, strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, fill: CHART.coral, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {weightDelta != null && (
                <p className="mt-6 text-center text-xs text-gray-500">
                  {weightDelta >= 0 ? '+' : ''}
                  {weightDelta.toFixed(1)} kg so với lần đo đầu ({chartData[0].label} →{' '}
                  {chartData.at(-1).label})
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
