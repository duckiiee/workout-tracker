/**
 * Trang quản lý buổi tập (CRUD) — gắn vào Dashboard khi cần:
 * import WorkoutHome from './WorkoutHome';
 * return <WorkoutHome />;
 */
import { useCallback, useEffect, useState } from 'react';

const API_URL = 'http://localhost:5000/api/workouts';

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function WorkoutCard({ workout, onDelete, isDeleting }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-900/80 p-5 shadow-lg transition hover:border-lime-500/50">
      <div className="relative">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-lime-500/15 text-sm font-bold text-lime-400">#{workout.WorkoutID}</span>
            <time className="text-sm font-semibold uppercase tracking-wide text-lime-400">{formatDate(workout.WorkoutDate)}</time>
          </div>
          <button type="button" onClick={() => onDelete(workout.WorkoutID)} disabled={isDeleting} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-bold uppercase text-red-400 hover:bg-red-500/20 disabled:opacity-50">
            {isDeleting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-400/30 border-t-red-400" /> : <TrashIcon />}
            {isDeleting ? 'Đang xóa...' : 'Xóa'}
          </button>
        </div>
        <p className="text-zinc-300">{workout.Notes || <span className="italic text-zinc-500">Không có ghi chú</span>}</p>
      </div>
    </article>
  );
}

export default function WorkoutHome() {
  const [workouts, setWorkouts] = useState([]);
  const [workoutDate, setWorkoutDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  const fetchWorkouts = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_URL);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không thể tải danh sách.');
      setWorkouts(result.data);
    } catch (err) {
      setError(err.message || 'Lỗi khi tải dữ liệu.');
      if (!silent) setWorkouts([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkouts(); }, [fetchWorkouts]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!workoutDate || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ WorkoutDate: workoutDate, Notes: notes.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không thể lưu.');
      setWorkoutDate('');
      setNotes('');
      await fetchWorkouts({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(workoutId) {
    if (deletingId || !window.confirm('Xóa buổi tập này?')) return;
    setDeletingId(workoutId);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/${workoutId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Không thể xóa.');
      setWorkouts((prev) => prev.filter((w) => w.WorkoutID !== workoutId));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {error && <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="mb-5 text-lg font-bold uppercase text-white">Thêm buổi tập mới</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="date" value={workoutDate} onChange={(e) => setWorkoutDate(e.target.value)} required disabled={submitting} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white [color-scheme:dark]" />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={submitting} placeholder="Ghi chú buổi tập..." className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
          <button type="submit" disabled={submitting} className="rounded-xl bg-lime-500 px-6 py-3 text-sm font-bold uppercase text-zinc-950 disabled:opacity-60">{submitting ? 'Đang lưu...' : 'Lưu'}</button>
        </form>
      </section>
      <section>
        {loading ? <p className="text-zinc-400">Đang tải...</p> : (
          <ul className="space-y-4">
            {workouts.map((w) => (
              <li key={w.WorkoutID}><WorkoutCard workout={w} onDelete={handleDelete} isDeleting={deletingId === w.WorkoutID} /></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
