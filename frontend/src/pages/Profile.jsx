import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

import { API_BASE } from '../config/api';

function formatRecordDate(dateStr) {
  const iso = dateStr?.includes?.('T') ? dateStr : `${dateStr}T00:00:00`;
  return format(new Date(iso), 'dd/MM/yyyy', { locale: vi });
}

function todayIsoDate() {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function Profile() {
  const [profileId, setProfileId] = useState(1);
  const [fullName, setFullName] = useState('');
  const [height, setHeight] = useState('');
  const [targetGoal, setTargetGoal] = useState('');

  const [weight, setWeight] = useState('');
  const [weightHistory, setWeightHistory] = useState([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);

  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [weightError, setWeightError] = useState(null);
  const [weightSuccess, setWeightSuccess] = useState(null);

  const loadWeightHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/weight`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể tải lịch sử cân nặng.');
      }

      setWeightHistory(result.data);
      setWeightError(null);
    } catch (err) {
      setWeightError(err.message || 'Không thể tải lịch sử cân nặng.');
      setWeightHistory([]);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/profile`);
      const result = await response.json();

      if (response.status === 404) {
        setProfileId(1);
        setFullName('');
        setHeight('');
        setTargetGoal('');
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể tải thông tin cá nhân.');
      }

      const data = result.data;
      setProfileId(data.ProfileID ?? 1);
      setFullName(data.FullName ?? '');
      setHeight(data.Height != null ? String(data.Height) : '');
      setTargetGoal(data.TargetGoal ?? '');
      setProfileError(null);
    } catch (err) {
      setProfileError(err.message || 'Không thể tải thông tin cá nhân.');
    }
  }, []);

  useEffect(() => {
    async function init() {
      setPageLoading(true);
      await Promise.all([loadProfile(), loadWeightHistory()]);
      setPageLoading(false);
    }
    init();
  }, [loadProfile, loadWeightHistory]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const response = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ProfileID: profileId,
          FullName: fullName.trim(),
          Height: height === '' ? null : Number(height),
          TargetGoal: targetGoal.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể lưu thông tin cá nhân.');
      }

      const data = result.data;
      setProfileId(data.ProfileID);
      setFullName(data.FullName ?? '');
      setHeight(data.Height != null ? String(data.Height) : '');
      setTargetGoal(data.TargetGoal ?? '');
      setProfileSuccess('Đã lưu thông tin cá nhân.');
    } catch (err) {
      setProfileError(err.message || 'Không thể lưu thông tin cá nhân.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleAddWeight(e) {
    e.preventDefault();
    if (!weight) return;

    setWeightSaving(true);
    setWeightError(null);
    setWeightSuccess(null);

    try {
      const response = await fetch(`${API_BASE}/weight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          RecordDate: todayIsoDate(),
          Weight: Number(weight),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể lưu cân nặng.');
      }

      setWeight('');
      setWeightSuccess('Đã thêm bản ghi cân nặng.');
      await loadWeightHistory();
    } catch (err) {
      setWeightError(err.message || 'Không thể lưu cân nặng.');
    } finally {
      setWeightSaving(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="loading-screen">
        <span className="spinner" />
        Đang tải hồ sơ...
      </div>
    );
  }

  return (
    <div className="page-shell mx-auto max-w-4xl">
      <header>
        <p className="page-kicker">Hồ sơ</p>
        <h1 className="page-title">Thông tin cá nhân</h1>
        <p className="page-desc">
          Cập nhật mục tiêu tập luyện và theo dõi cân nặng hàng ngày.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="apple-card-lg">
          <h2 className="card-title">Thông tin cá nhân</h2>
          <p className="card-subtitle mb-6">Họ tên, chiều cao và mục tiêu của bạn</p>

          {profileError && (
            <div role="alert" className="alert-error mb-4">
              {profileError}
            </div>
          )}
          {profileSuccess && (
            <div role="status" className="alert-success mb-4">
              {profileSuccess}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div>
              <label htmlFor="fullName" className="apple-label">
                Tên (FullName)
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={profileSaving}
                placeholder="Nguyễn Văn A"
                className="apple-input"
              />
            </div>

            <div>
              <label htmlFor="height" className="apple-label">
                Chiều cao (cm)
              </label>
              <input
                id="height"
                type="number"
                min="1"
                step="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                disabled={profileSaving}
                placeholder="175"
                className="apple-input"
              />
            </div>

            <div>
              <label htmlFor="targetGoal" className="apple-label">
                Mục tiêu (TargetGoal)
              </label>
              <textarea
                id="targetGoal"
                value={targetGoal}
                onChange={(e) => setTargetGoal(e.target.value)}
                disabled={profileSaving}
                rows={3}
                placeholder="Ví dụ: Tăng cơ, giảm mỡ, duy trì sức khỏe..."
                className="apple-input resize-none"
              />
            </div>

            <button type="submit" disabled={profileSaving} className="btn-primary w-full">
              {profileSaving ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </form>
        </section>

        <section className="apple-card-lg">
          <h2 className="card-title">Cập nhật cân nặng</h2>
          <p className="card-subtitle mb-6">
            Ghi nhận cân nặng hôm nay ({formatRecordDate(todayIsoDate())})
          </p>

          {weightError && (
            <div role="alert" className="alert-error mb-4">
              {weightError}
            </div>
          )}
          {weightSuccess && (
            <div role="status" className="alert-success mb-4">
              {weightSuccess}
            </div>
          )}

          <form onSubmit={handleAddWeight} className="mb-8 space-y-5">
            <div>
              <label htmlFor="weight" className="apple-label">
                Cân nặng hôm nay (kg)
              </label>
              <input
                id="weight"
                type="number"
                min="0.1"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                disabled={weightSaving}
                required
                placeholder="70"
                className="apple-input"
              />
            </div>

            <button
              type="submit"
              disabled={weightSaving || !weight}
              className="btn-secondary w-full"
            >
              {weightSaving ? 'Đang thêm...' : 'Thêm'}
            </button>
          </form>

          <div>
            <h3 className="card-title text-base">Lịch sử cân nặng</h3>

            {weightHistory.length === 0 ? (
              <p className="empty-state py-10">
                Chưa có bản ghi nào.
              </p>
            ) : (
              <div className="glass-inset overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-5 py-3">Ngày</th>
                      <th className="px-5 py-3 text-right">Cân nặng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {weightHistory.map((record) => (
                      <tr key={record.RecordID} className="transition hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-700">
                          {formatRecordDate(record.RecordDate)}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-black">
                          {Number(record.Weight)} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
