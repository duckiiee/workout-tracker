import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
  subWeeks,
} from 'date-fns';
import { vi } from 'date-fns/locale';

import { API_BASE } from '../config/api';
const WEEK_OPTS = { weekStartsOn: 1 };

const inputClass = 'apple-input-sm';

const inlineInputClass =
  'w-12 rounded-lg border border-gray-300 bg-white/80 px-1 py-0.5 text-center text-xs font-semibold text-gray-900 outline-none shadow-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400/40';

const modalInputClass = 'apple-input';

const DAY_OPTIONS = [
  { value: 2, label: 'Thứ 2' },
  { value: 3, label: 'Thứ 3' },
  { value: 4, label: 'Thứ 4' },
  { value: 5, label: 'Thứ 5' },
  { value: 6, label: 'Thứ 6' },
  { value: 7, label: 'Thứ 7' },
  { value: 8, label: 'Chủ Nhật' },
];

const EMPTY_TEMPLATE_FORM = {
  exerciseId: '',
  sets: '',
  reps: '',
  weight: '',
};

function toDateKey(value) {
  const iso = value?.includes?.('T') ? value : `${value}T00:00:00`;
  return format(new Date(iso), 'yyyy-MM-dd');
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Yêu cầu thất bại.');
  }
  return result.data;
}

function isDetailCompleted(value) {
  return value === true || value === 1;
}

function DefaultScheduleModal({ open, onClose, exercises }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(2);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_TEMPLATE_FORM);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson(`${API_BASE}/default-schedule`);
      setItems(data);
    } catch (err) {
      setError(err.message || 'Không thể tải lịch mặc định.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadTemplates();
      setEditingId(null);
      setForm(EMPTY_TEMPLATE_FORM);
      setSelectedDay(2);
    }
  }, [open, loadTemplates]);

  const dayItems = useMemo(
    () => items.filter((item) => Number(item.DayOfWeek) === selectedDay),
    [items, selectedDay]
  );

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_TEMPLATE_FORM);
  }

  function startEdit(item) {
    setEditingId(item.TemplateID);
    setSelectedDay(Number(item.DayOfWeek));
    setForm({
      exerciseId: String(item.ExerciseID),
      sets: String(item.Sets),
      reps: String(item.Reps),
      weight: String(item.Weight),
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.exerciseId || !form.sets || !form.reps || form.weight === '' || saving) return;

    setSaving(true);
    setError(null);

    const payload = {
      DayOfWeek: selectedDay,
      ExerciseID: Number(form.exerciseId),
      Sets: Number(form.sets),
      Reps: Number(form.reps),
      Weight: Number(form.weight),
    };

    try {
      if (editingId) {
        const updated = await fetchJson(`${API_BASE}/default-schedule/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setItems((prev) =>
          prev.map((item) => (item.TemplateID === editingId ? updated : item))
        );
      } else {
        const created = await fetchJson(`${API_BASE}/default-schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setItems((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      setError(err.message || 'Không thể lưu mẫu lịch.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    const label = item.ExerciseName ?? `#${item.ExerciseID}`;
    if (!window.confirm(`Xóa "${label}" khỏi lịch mặc định?`)) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/default-schedule/${item.TemplateID}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể xóa mẫu lịch.');
      }
      setItems((prev) => prev.filter((row) => row.TemplateID !== item.TemplateID));
      if (editingId === item.TemplateID) resetForm();
    } catch (err) {
      setError(err.message || 'Không thể xóa mẫu lịch.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/20 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="default-schedule-title"
        className="glass-modal flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-300 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Lịch mẫu</p>
            <h2 id="default-schedule-title" className="mt-1 text-xl font-black text-gray-900">
              Cài đặt lịch mặc định
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Thiết lập bài tập cố định cho từng thứ trong tuần
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-gray-300 px-4 py-3">
          {DAY_OPTIONS.map((day) => {
            const count = items.filter((i) => Number(i.DayOfWeek) === day.value).length;
            const active = selectedDay === day.value;
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => {
                  setSelectedDay(day.value);
                  resetForm();
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-black text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-black'
                }`}
              >
                {day.label}
                {count > 0 && (
                  <span className="ml-1 opacity-70">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div role="alert" className="alert-error mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
              Đang tải...
            </div>
          ) : dayItems.length === 0 ? (
            <p className="empty-state py-8">
              Chưa có bài tập mẫu cho{' '}
              {DAY_OPTIONS.find((d) => d.value === selectedDay)?.label}.
            </p>
          ) : (
            <ul className="space-y-2">
              {dayItems.map((item) => (
                <li
                  key={item.TemplateID}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-md shadow-gray-200/40 transition ${
                    editingId === item.TemplateID
                      ? 'border-gray-400 bg-gray-50'
                      : 'border-gray-300 bg-white/60'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{item.ExerciseName}</p>
                    <p className="text-xs text-gray-500">
                      {item.Sets} sets × {item.Reps} reps · {Number(item.Weight)} kg
                      {item.MuscleGroup && ` · ${item.MuscleGroup}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      disabled={saving}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700 transition hover:border-gray-300 hover:text-gray-600 disabled:opacity-50"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={saving}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-500 transition hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
                    >
                      Xóa
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-gray-300 bg-gray-50 px-6 py-4"
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
            {editingId ? 'Cập nhật bài mẫu' : 'Thêm bài mẫu'} —{' '}
            {DAY_OPTIONS.find((d) => d.value === selectedDay)?.label}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <select
              value={form.exerciseId}
              onChange={(e) => setForm((f) => ({ ...f, exerciseId: e.target.value }))}
              disabled={saving || exercises.length === 0}
              className={`${modalInputClass} sm:col-span-2 lg:col-span-2`}
              required
            >
              <option value="">Chọn bài tập</option>
              {exercises.map((ex) => (
                <option key={ex.ExerciseID} value={ex.ExerciseID}>
                  {ex.Name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              placeholder="Sets"
              value={form.sets}
              onChange={(e) => setForm((f) => ({ ...f, sets: e.target.value }))}
              disabled={saving}
              className={modalInputClass}
              required
            />
            <input
              type="number"
              min="1"
              placeholder="Reps"
              value={form.reps}
              onChange={(e) => setForm((f) => ({ ...f, reps: e.target.value }))}
              disabled={saving}
              className={modalInputClass}
              required
            />
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="Kg"
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
              disabled={saving}
              className={modalInputClass}
              required
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving || !form.exerciseId}
              className="btn-primary-sm disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm bài'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="btn-secondary-sm disabled:opacity-50"
              >
                Hủy sửa
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function InlineNumberCell({ value, field, detail, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  async function commit() {
    const num = Number(draft);
    if (
      Number.isNaN(num) ||
      num < 0 ||
      (field !== 'Weight' && (!Number.isInteger(num) || num <= 0))
    ) {
      setDraft(String(value));
      setEditing(false);
      return;
    }
    if (num === Number(value)) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(detail.DetailID, {
        WorkoutID: detail.WorkoutID,
        ExerciseID: detail.ExerciseID,
        Sets: field === 'Sets' ? num : detail.Sets,
        Reps: field === 'Reps' ? num : detail.Reps,
        Weight: field === 'Weight' ? num : Number(detail.Weight),
      });
      setEditing(false);
    } catch {
      setDraft(String(value));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={field === 'Weight' ? 0 : 1}
        step={field === 'Weight' ? 0.5 : 1}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className={inlineInputClass}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="rounded px-1 py-0.5 font-semibold text-gray-900 transition hover:bg-gray-100 hover:text-black"
      title="Click để sửa"
    >
      {field === 'Weight' ? Number(value) : value}
    </button>
  );
}

function DayColumn({
  day,
  isToday,
  details,
  exerciseMap,
  exercises,
  quickDraft,
  onQuickDraftChange,
  onQuickAdd,
  onSaveDetail,
  onToggleComplete,
  onDeleteDetail,
  completingId,
  deletingId,
  adding,
  workoutForDay,
}) {
  return (
    <div className="glass-card flex min-h-[420px] min-w-[140px] flex-1 flex-col p-0 overflow-hidden">
      <div
        className={`border-b border-gray-300 px-3 py-4 text-center ${isToday ? 'bg-white/50' : ''}`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          {format(day, 'EEE', { locale: vi })}
        </p>
        <p className={`mt-1 text-lg font-bold tracking-tight ${isToday ? 'text-emerald-600' : 'text-gray-900'}`}>
          {format(day, 'dd/MM')}
        </p>
        {workoutForDay && (
          <p className="mt-1 text-[10px] text-gray-500">Buổi #{workoutForDay.WorkoutID}</p>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {details.length === 0 ? (
          <p className="py-6 text-center text-[11px] italic text-gray-400">Trống</p>
        ) : (
          details.map((detail) => {
            const exercise = exerciseMap.get(detail.ExerciseID);
            const done = isDetailCompleted(detail.IsCompleted);
            const isCompleting = completingId === detail.DetailID;
            const isDeleting = deletingId === detail.DetailID;
            const isBusy = isCompleting || isDeleting;

            return (
              <div
                key={detail.DetailID}
                className={`rounded-lg border p-2.5 shadow-sm shadow-gray-200/30 transition ${
                  done
                    ? 'border-emerald-300 bg-emerald-50/70'
                    : 'border-gray-300 bg-white/60'
                } ${isBusy ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <p
                    className={`min-w-0 flex-1 truncate text-xs font-bold ${
                      done
                        ? 'text-gray-500 line-through decoration-gray-400'
                        : 'text-gray-900'
                    }`}
                    title={exercise?.Name}
                  >
                    {exercise?.Name ?? `#${detail.ExerciseID}`}
                  </p>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {done ? (
                      <button
                        type="button"
                        onClick={() => onToggleComplete?.(detail)}
                        disabled={isBusy}
                        title="Bỏ đánh dấu"
                        className="text-[9px] font-bold uppercase text-gray-600 transition hover:text-gray-500 disabled:opacity-50"
                      >
                        {isCompleting ? '…' : 'Đã tập'}
                      </button>
                    ) : (
                      onToggleComplete && (
                        <button
                          type="button"
                          onClick={() => onToggleComplete(detail)}
                          disabled={isBusy}
                          title="Đánh dấu đã tập"
                          className="rounded border border-gray-300 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500 transition hover:border-gray-400 hover:text-gray-600 disabled:opacity-50"
                        >
                          {isCompleting ? '…' : '✓'}
                        </button>
                      )
                    )}
                    {onDeleteDetail && (
                      <button
                        type="button"
                        onClick={() => onDeleteDetail(detail, exercise?.Name)}
                        disabled={isBusy}
                        title="Xóa bài tập"
                        className="rounded px-1 py-0.5 text-sm leading-none text-gray-500 transition hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
                      >
                        {isDeleting ? '…' : '×'}
                      </button>
                    )}
                  </div>
                </div>
                {exercise?.MuscleGroup && (
                  <p className="truncate text-[10px] text-gray-500">{exercise.MuscleGroup}</p>
                )}
                <div className="mt-2 flex items-center justify-between gap-1 text-[10px] text-gray-500">
                  <span>
                    S{' '}
                    <InlineNumberCell
                      value={detail.Sets}
                      field="Sets"
                      detail={detail}
                      onSave={onSaveDetail}
                    />
                  </span>
                  <span>
                    R{' '}
                    <InlineNumberCell
                      value={detail.Reps}
                      field="Reps"
                      detail={detail}
                      onSave={onSaveDetail}
                    />
                  </span>
                  <span>
                    kg{' '}
                    <InlineNumberCell
                      value={detail.Weight}
                      field="Weight"
                      detail={detail}
                      onSave={onSaveDetail}
                    />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-gray-300 p-2">
        <div className="space-y-1.5">
          <select
            value={quickDraft.exerciseId}
            onChange={(e) => onQuickDraftChange({ exerciseId: e.target.value })}
            disabled={adding || exercises.length === 0}
            className={inputClass}
          >
            <option value="">Bài tập</option>
            {exercises.map((ex) => (
              <option key={ex.ExerciseID} value={ex.ExerciseID}>
                {ex.Name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-1">
            <input
              type="number"
              min="1"
              placeholder="Set"
              value={quickDraft.sets}
              onChange={(e) => onQuickDraftChange({ sets: e.target.value })}
              disabled={adding}
              className={inputClass}
            />
            <input
              type="number"
              min="1"
              placeholder="Rep"
              value={quickDraft.reps}
              onChange={(e) => onQuickDraftChange({ reps: e.target.value })}
              disabled={adding}
              className={inputClass}
            />
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="Kg"
              value={quickDraft.weight}
              onChange={(e) => onQuickDraftChange({ weight: e.target.value })}
              disabled={adding}
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={onQuickAdd}
            disabled={adding || !quickDraft.exerciseId}
            className="btn-primary-sm flex w-full disabled:opacity-40"
          >
            {adding ? '...' : '+'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WorkoutSchedule() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), WEEK_OPTS));
  const [workouts, setWorkouts] = useState([]);
  const [details, setDetails] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingDay, setAddingDay] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showDefaultModal, setShowDefaultModal] = useState(false);
  const [applyingDefault, setApplyingDefault] = useState(false);
  const [applySuccess, setApplySuccess] = useState(null);
  const [quickDrafts, setQuickDrafts] = useState({});

  const weekEnd = useMemo(() => endOfWeek(weekStart, WEEK_OPTS), [weekStart]);
  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd]
  );

  const rangeLabel = `${format(weekStart, 'dd/MM/yyyy')} – ${format(weekEnd, 'dd/MM/yyyy')}`;

  const exerciseMap = useMemo(() => {
    const map = new Map();
    exercises.forEach((ex) => map.set(ex.ExerciseID, ex));
    return map;
  }, [exercises]);

  const workoutsByDate = useMemo(() => {
    const map = new Map();
    workouts.forEach((w) => {
      const key = toDateKey(w.WorkoutDate);
      if (!map.has(key)) map.set(key, w);
    });
    return map;
  }, [workouts]);

  const detailsByDate = useMemo(() => {
    const map = new Map();
    weekDays.forEach((day) => map.set(format(day, 'yyyy-MM-dd'), []));
    details.forEach((d) => {
      const key = toDateKey(d.WorkoutDate);
      if (map.has(key)) map.get(key).push(d);
    });
    return map;
  }, [details, weekDays]);

  const loadWeek = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const start = format(weekStart, 'yyyy-MM-dd');
    const end = format(weekEnd, 'yyyy-MM-dd');

    try {
      const [workoutData, detailData, exerciseData] = await Promise.all([
        fetchJson(`${API_BASE}/workouts?startDate=${start}&endDate=${end}`),
        fetchJson(`${API_BASE}/workout-details?startDate=${start}&endDate=${end}`),
        fetchJson(`${API_BASE}/exercises`),
      ]);
      setWorkouts(workoutData);
      setDetails(detailData);
      setExercises(exerciseData);
    } catch (err) {
      setError(err.message || 'Không thể tải lịch tuần.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === 'visible') {
        loadWeek(true);
      }
    }
    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
  }, [loadWeek]);

  function goToThisWeek() {
    setWeekStart(startOfWeek(new Date(), WEEK_OPTS));
  }

  function getQuickDraft(dateKeyStr) {
    return quickDrafts[dateKeyStr] ?? { exerciseId: '', sets: '', reps: '', weight: '' };
  }

  function updateQuickDraft(dateKeyStr, patch) {
    setQuickDrafts((prev) => ({
      ...prev,
      [dateKeyStr]: { ...getQuickDraft(dateKeyStr), ...patch },
    }));
  }

  async function getOrCreateWorkout(dateKeyStr) {
    const existing = workoutsByDate.get(dateKeyStr);
    if (existing) return existing;

    const created = await fetchJson(`${API_BASE}/workouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        WorkoutDate: dateKeyStr,
        Notes: `Buổi tập ${format(new Date(`${dateKeyStr}T00:00:00`), 'dd/MM/yyyy')}`,
      }),
    });
    setWorkouts((prev) => [...prev, created]);
    return created;
  }

  async function handleQuickAdd(dateKeyStr) {
    const draft = getQuickDraft(dateKeyStr);
    if (!draft.exerciseId || !draft.sets || !draft.reps || draft.weight === '') {
      setError('Vui lòng chọn bài tập và điền đủ Set, Rep, Kg.');
      return;
    }

    setAddingDay(dateKeyStr);
    setError(null);

    try {
      const workout = await getOrCreateWorkout(dateKeyStr);
      const newDetail = await fetchJson(`${API_BASE}/workout-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          WorkoutID: workout.WorkoutID,
          ExerciseID: Number(draft.exerciseId),
          Sets: Number(draft.sets),
          Reps: Number(draft.reps),
          Weight: Number(draft.weight),
        }),
      });

      setDetails((prev) => [...prev, { ...newDetail, WorkoutDate: workout.WorkoutDate }]);
      updateQuickDraft(dateKeyStr, { exerciseId: '', sets: '', reps: '', weight: '' });
    } catch (err) {
      setError(err.message || 'Không thể thêm bài tập.');
    } finally {
      setAddingDay(null);
    }
  }

  async function handleSaveDetail(detailId, payload) {
    const updated = await fetchJson(`${API_BASE}/workout-details/${detailId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setDetails((prev) =>
      prev.map((d) =>
        d.DetailID === detailId ? { ...d, ...updated, WorkoutDate: d.WorkoutDate } : d
      )
    );
  }

  async function handleToggleComplete(detail) {
    if (completingId) return;

    const nextCompleted = !isDetailCompleted(detail.IsCompleted);
    setCompletingId(detail.DetailID);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/workout-details/${detail.DetailID}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ IsCompleted: nextCompleted }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể cập nhật trạng thái bài tập.');
      }

      setDetails((prev) =>
        prev.map((d) =>
          d.DetailID === result.data.DetailID ? { ...d, ...result.data } : d
        )
      );

      if (result.workoutCompleted !== undefined) {
        const workoutId = result.data.WorkoutID;
        setWorkouts((prev) =>
          prev.map((w) =>
            w.WorkoutID === workoutId ? { ...w, IsCompleted: result.workoutCompleted } : w
          )
        );
      }
    } catch (err) {
      setError(err.message || 'Không thể cập nhật trạng thái bài tập.');
    } finally {
      setCompletingId(null);
    }
  }

  async function handleDeleteDetail(detail, exerciseName) {
    if (deletingId) return;

    const label = exerciseName ?? `#${detail.ExerciseID}`;
    if (!window.confirm(`Xóa "${label}" khỏi lịch?`)) return;

    setDeletingId(detail.DetailID);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/workout-details/${detail.DetailID}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể xóa bài tập.');
      }

      setDetails((prev) => prev.filter((d) => d.DetailID !== detail.DetailID));

      if (result.workoutCompleted !== undefined && result.workoutId != null) {
        setWorkouts((prev) =>
          prev.map((w) =>
            w.WorkoutID === result.workoutId
              ? { ...w, IsCompleted: result.workoutCompleted }
              : w
          )
        );
      }
    } catch (err) {
      setError(err.message || 'Không thể xóa bài tập.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleApplyDefault() {
    if (applyingDefault) return;

    const startDate = format(weekStart, 'yyyy-MM-dd');
    if (
      !window.confirm(
        `Áp dụng lịch mặc định vào tuần bắt đầu ${startDate}? Các bài mẫu sẽ được thêm vào lịch (không xóa bài hiện có).`
      )
    ) {
      return;
    }

    setApplyingDefault(true);
    setError(null);
    setApplySuccess(null);

    try {
      const response = await fetch(`${API_BASE}/workouts/apply-default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể áp dụng lịch mặc định.');
      }

      const { workoutsCreated, detailsCreated, message } = result.data;
      setApplySuccess(
        message ??
          `Đã tạo ${workoutsCreated} buổi tập và ${detailsCreated} bài tập từ lịch mặc định.`
      );
      await loadWeek(true);
    } catch (err) {
      setError(err.message || 'Không thể áp dụng lịch mặc định.');
    } finally {
      setApplyingDefault(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <span className="spinner" />
        Đang tải lịch tuần...
      </div>
    );
  }

  return (
    <div className="page-shell">
      <header>
        <p className="page-kicker">Lịch tập</p>
        <h1 className="page-title">Lịch tuần</h1>
        <p className="page-desc">
          Click vào S / R / kg để sửa trực tiếp · Enter hoặc click ra ngoài để lưu
        </p>
      </header>

      {error && (
        <div role="alert" className="alert-error">
          {error}
        </div>
      )}

      {applySuccess && (
        <div role="status" className="alert-success">
          {applySuccess}
        </div>
      )}

      <section className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setShowDefaultModal(true)} className="btn-secondary">
          Cài đặt Lịch mặc định
        </button>
        <button
          type="button"
          onClick={handleApplyDefault}
          disabled={applyingDefault}
          className="btn-primary disabled:opacity-50"
        >
          {applyingDefault ? 'Đang áp dụng...' : 'Áp dụng lịch mặc định vào tuần này'}
        </button>
      </section>

      <section className="apple-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Tuần đang xem</p>
          <p className="mt-1 font-semibold text-gray-900">{rangeLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((d) => subWeeks(d, 1))}
            className="btn-secondary-sm"
          >
            ← Tuần trước
          </button>
          <button type="button" onClick={goToThisWeek} className="btn-primary-sm">
            Tuần này
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((d) => addWeeks(d, 1))}
            className="btn-secondary-sm"
          >
            Tuần sau →
          </button>
        </div>
      </section>

      <section className="overflow-x-auto pb-2">
        <div className="flex min-w-[980px] gap-2">
          {weekDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            return (
              <DayColumn
                key={key}
                day={day}
                isToday={isSameDay(day, new Date())}
                details={detailsByDate.get(key) ?? []}
                exerciseMap={exerciseMap}
                exercises={exercises}
                workoutForDay={workoutsByDate.get(key)}
                quickDraft={getQuickDraft(key)}
                onQuickDraftChange={(patch) => updateQuickDraft(key, patch)}
                onQuickAdd={() => handleQuickAdd(key)}
                onSaveDetail={handleSaveDetail}
                onToggleComplete={handleToggleComplete}
                onDeleteDetail={handleDeleteDetail}
                completingId={completingId}
                deletingId={deletingId}
                adding={addingDay === key}
              />
            );
          })}
        </div>
      </section>

      <DefaultScheduleModal
        open={showDefaultModal}
        onClose={() => setShowDefaultModal(false)}
        exercises={exercises}
      />
    </div>
  );
}
