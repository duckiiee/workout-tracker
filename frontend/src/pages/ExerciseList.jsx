import { useCallback, useEffect, useState } from 'react';

import { API_BASE } from '../config/api';

function muscleBadgeClass() {
  return 'bg-gray-100 text-gray-700 border-gray-300';
}

export default function ExerciseList() {
  const [exercises, setExercises] = useState([]);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchExercises = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/exercises`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể tải danh sách bài tập.');
      }

      setExercises(result.data);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách bài tập.');
      if (!silent) setExercises([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE}/exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Name: name.trim(),
          MuscleGroup: muscleGroup.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể thêm bài tập.');
      }

      setName('');
      setMuscleGroup('');
      setSuccess(`Đã thêm "${result.data.Name}".`);
      await fetchExercises({ silent: true });
    } catch (err) {
      setError(err.message || 'Không thể thêm bài tập.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <span className="spinner" />
        Đang tải danh sách bài tập...
      </div>
    );
  }

  return (
    <div className="page-shell mx-auto max-w-4xl">
      <header>
        <p className="page-kicker">Thư viện</p>
        <h1 className="page-title">Danh sách bài tập</h1>
        <p className="page-desc">Quản lý bài tập và nhóm cơ trong hệ thống.</p>
      </header>

      {error && (
        <div role="alert" className="alert-error">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="alert-success">
          {success}
        </div>
      )}

      <section className="apple-card-lg">
        <h2 className="card-title">Thêm bài tập mới</h2>
        <p className="card-subtitle mb-6">Tạo bài tập để dùng trong lịch tập</p>

        <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="exerciseName" className="apple-label">
              Tên bài
            </label>
            <input
              id="exerciseName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={submitting}
              placeholder="Ví dụ: Bench Press"
              className="apple-input"
            />
          </div>

          <div>
            <label htmlFor="muscleGroup" className="apple-label">
              Nhóm cơ
            </label>
            <input
              id="muscleGroup"
              type="text"
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value)}
              disabled={submitting}
              placeholder="Ví dụ: Ngực, Chân, Lưng..."
              className="apple-input"
            />
          </div>

          <div className="sm:col-span-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Đang thêm...' : 'Thêm bài tập'}
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between">
          <h2 className="card-title">Tất cả bài tập</h2>
          <span className="badge-pill">{exercises.length} bài</span>
        </div>

        {exercises.length === 0 ? (
          <p className="empty-state py-16">
            Chưa có bài tập nào. Thêm bài tập đầu tiên ở trên.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {exercises.map((exercise) => (
              <li
                key={exercise.ExerciseID}
                className="glass-card transition hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-gray-400">
                      #{exercise.ExerciseID}
                    </span>
                    <h3 className="mt-1 truncate text-lg font-semibold text-black">
                      {exercise.Name}
                    </h3>
                  </div>
                  {exercise.MuscleGroup && (
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${muscleBadgeClass()}`}
                    >
                      {exercise.MuscleGroup}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
