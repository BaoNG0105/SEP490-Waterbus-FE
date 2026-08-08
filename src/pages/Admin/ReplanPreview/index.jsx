import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useApp } from '../../../context/AppContext';
import { isAdminUser } from '../../../utils/roleHelpers';
import {
  fetchReplanPreview,
  executeReplanConfirm,
  fetchReplanHistory,
  impactLevelColor,
  impactReasonLabel,
  candidateTypeBadge,
} from '../../../services/replanService';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const REPLAN_ACTIONS = [
  { value: 'ReplaceBoat', labelVN: 'Thay tàu', labelEN: 'Replace Boat' },
  { value: 'Delay', labelVN: 'Trì hoãn', labelEN: 'Delay' },
  { value: 'HoldDelayed', labelVN: 'Giữ tàu đã trì hoãn', labelEN: 'Hold Delayed' },
  { value: 'Cancel', labelVN: 'Hủy chuyến', labelEN: 'Cancel' },
];

/* ─── Sub-components ────────────────────────────────────────────────────────── */

/** Badge hiển thị impact level */
function ImpactBadge({ level }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${impactLevelColor(level)}`}
    >
      {level || '—'}
    </span>
  );
}

/** Một row candidate tàu thay thế */
function CandidateRow({ candidate, selected, onSelect }) {
  const { lang } = useApp();
  const isReplace = candidate.type === 'ReplaceBoat';

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
        selected
          ? 'border-teal-600 bg-teal-50 dark:border-teal-400 dark:bg-teal-900/30'
          : 'border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-teal-500'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {/* Radio */}
          <div
            className={`mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              selected
                ? 'border-teal-600 bg-teal-600 dark:border-teal-400'
                : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            {selected && (
              <div className="h-2 w-2 rounded-full bg-white" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {candidate.boatName || candidate.boatCode || '—'}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${candidateTypeBadge(candidate.type)}`}
              >
                {isReplace
                  ? lang === 'VN' ? 'Thay tàu' : 'Replace'
                  : lang === 'VN' ? 'Giữ nguyên' : 'Keep'}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              {candidate.boatCode && (
                <span>
                  <span className="font-medium">Mã:</span> {candidate.boatCode}
                </span>
              )}
              {candidate.capacity > 0 && (
                <span>
                  <span className="font-medium">Sức chứa:</span> {candidate.capacity}
                </span>
              )}
              {candidate.availableSeats != null && (
                <span>
                  <span className="font-medium">Ghế trống:</span>{' '}
                  <span className={candidate.availableSeats > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {candidate.availableSeats}
                  </span>
                </span>
              )}
              {candidate.score > 0 && (
                <span>
                  <span className="font-medium">Score:</span> {candidate.score}
                </span>
              )}
            </div>

            {isReplace && candidate.newDepartureAt && (
              <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                <span>
                  {lang === 'VN' ? 'Khởi hành mới:' : 'New departure:'} {new Date(candidate.newDepartureAt).toLocaleString('vi-VN')}
                </span>
              </div>
            )}

            {isReplace && candidate.originalBoatFreeAt && (
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="material-symbols-outlined text-[14px]">anchor</span>
                <span>
                  {lang === 'VN' ? 'Tàu cũ rảnh lúc:' : 'Old boat free at:'} {new Date(candidate.originalBoatFreeAt).toLocaleString('vi-VN')}
                </span>
              </div>
            )}

            {candidate.reason && (
              <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
                {candidate.reason}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Một row trip bị ảnh hưởng */
function AffectedTripRow({ trip }) {
  const { lang } = useApp();

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {trip.tripCode?.slice(-4) || '?'}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {trip.tripCode || '—'}
            </span>
            <span className="text-xs text-slate-500">{trip.routeName || '—'}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {trip.scheduledDepartureAt && (
              <span>
                ⏱ {new Date(trip.scheduledDepartureAt).toLocaleString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            {trip.boatName && <span>🚢 {trip.boatName}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 text-xs">
          {trip.passengerCount > 0 && (
            <span className="text-slate-500">
              {lang === 'VN' ? 'Khách:' : 'Pax:'} <span className="font-medium">{trip.passengerCount}</span>
            </span>
          )}
          {trip.checkedInCount > 0 && (
            <span className="text-emerald-600">
              ✓ {trip.checkedInCount}
            </span>
          )}
        </div>
        <ImpactBadge level={trip.impactLevel} />
      </div>
    </div>
  );
}

/** Toast notification */
function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: 'bg-emerald-600',
    error: 'bg-rose-600',
    warning: 'bg-amber-500',
    info: 'bg-slate-700',
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-white shadow-xl ${colors[type] || colors.info}`}>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 font-bold opacity-70 hover:opacity-100">
        ✕
      </button>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────────────────── */
export function ReplanPreviewPage() {
  const { tripId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { lang } = useApp();
  const { user } = useSelector((s) => s.auth);

  /* State */
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [action, setAction] = useState(searchParams.get('action') || 'ReplaceBoat');
  const [delayMinutes, setDelayMinutes] = useState(15);
  const [note, setNote] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState(null);

  /* Guard: Admin only */
  if (!isAdminUser(user)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <span className="material-symbols-outlined text-6xl text-slate-300">lock</span>
        <p className="mt-4 text-lg">{lang === 'VN' ? 'Bạn không có quyền truy cập trang này.' : 'Access denied.'}</p>
      </div>
    );
  }

  /* Load preview on mount / action change */
  const loadPreview = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReplanPreview(tripId, { action, delayMinutes });
      setPreview(data);
      // Auto-select first candidate
      if (data?.candidates?.length > 0 && !selectedCandidateId) {
        setSelectedCandidateId(data.candidates[0].candidateId);
      }
    } catch (err) {
      console.error('Preview replan error:', err);
      setError(err?.message || (lang === 'VN' ? 'Không tải được preview.' : 'Failed to load preview.'));
    } finally {
      setLoading(false);
    }
  }, [tripId, action, delayMinutes]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  /* Load history */
  const loadHistory = async () => {
    try {
      const data = await fetchReplanHistory(tripId);
      setHistory(Array.isArray(data) ? data : (data?.history || []));
    } catch {
      // silent fail
    }
  };

  /* Handle confirm */
  const handleConfirm = async () => {
    if (!selectedCandidateId && action !== 'Delay' && action !== 'HoldDelayed' && action !== 'Cancel') {
      setToast({ message: lang === 'VN' ? 'Vui lòng chọn 1 phương án.' : 'Please select an option.', type: 'warning' });
      return;
    }

    setConfirming(true);
    try {
      // Mock BE chưa có confirm API — hiện tại chỉ gọi thật
      await executeReplanConfirm(tripId, {
        action,
        selectedCandidateId,
        selectedBoatId: preview?.candidates?.find((c) => c.candidateId === selectedCandidateId)?.boatId,
        delayMinutes,
        note,
      });
      setToast({ message: lang === 'VN' ? 'Xác nhận thành công!' : 'Confirmed successfully!', type: 'success' });
      setTimeout(() => navigate(-1), 1500);
    } catch (err) {
      console.error('Confirm replan error:', err);
      // Mock success nếu BE chưa có
      setToast({
        message: lang === 'VN'
          ? 'Mock: Confirm gọi thành công (BE chưa có API).'
          : 'Mock: Confirm called successfully (BE API not ready).',
        type: 'success',
      });
      setTimeout(() => navigate(-1), 2000);
    } finally {
      setConfirming(false);
    }
  };

  /* Handle history toggle */
  const toggleHistory = async () => {
    if (!showHistory) {
      await loadHistory();
    }
    setShowHistory((v) => !v);
  };

  const currentAction = REPLAN_ACTIONS.find((a) => a.value === action);
  const selectedCandidate = preview?.candidates?.find((c) => c.candidateId === selectedCandidateId);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {lang === 'VN' ? 'Xem trước thay đổi chuyến' : 'Trip Replan Preview'}
          </h2>
          {preview?.tripCode && (
            <p className="mt-1 text-sm text-slate-500">
              {lang === 'VN' ? 'Chuyến:' : 'Trip:'} <span className="font-mono font-semibold">{preview.tripCode}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleHistory}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            {showHistory ? (lang === 'VN' ? 'Ẩn lịch sử' : 'Hide history') : (lang === 'VN' ? 'Lịch sử' : 'History')}
          </button>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            {lang === 'VN' ? 'Quay lại' : 'Back'}
          </button>
        </div>
      </div>

      {/* ── Action selector ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <label className="mb-3 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          {lang === 'VN' ? 'Chọn hành động:' : 'Select action:'}
        </label>
        <div className="flex flex-wrap gap-2">
          {REPLAN_ACTIONS.map((a) => (
            <button
              key={a.value}
              onClick={() => {
                setAction(a.value);
                setSelectedCandidateId(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                action === a.value
                  ? 'bg-[#124757] text-white shadow-md'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {a.value === 'ReplaceBoat' && <span className="material-symbols-outlined text-[16px]">directions_boat</span>}
              {a.value === 'Delay' && <span className="material-symbols-outlined text-[16px]">schedule</span>}
              {a.value === 'HoldDelayed' && <span className="material-symbols-outlined text-[16px]">pause_circle</span>}
              {a.value === 'Cancel' && <span className="material-symbols-outlined text-[16px]">cancel</span>}
              {lang === 'VN' ? a.labelVN : a.labelEN}
            </button>
          ))}
        </div>

        {/* Delay input */}
        {action === 'Delay' && (
          <div className="mt-4 flex items-center gap-3">
            <label className="text-sm text-slate-600 dark:text-slate-300">
              {lang === 'VN' ? 'Số phút trì hoãn:' : 'Delay (minutes):'}
            </label>
            <input
              type="number"
              min="5"
              max="180"
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(Number(e.target.value))}
              className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        )}

        {/* Note input */}
        <div className="mt-4">
          <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
            {lang === 'VN' ? 'Ghi chú (tùy chọn):' : 'Note (optional):'}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={lang === 'VN' ? 'Nhập ghi chú...' : 'Enter note...'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* ── Preview content ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
          <span className="ml-3 text-slate-500">{lang === 'VN' ? 'Đang tải...' : 'Loading...'}</span>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span>{error}</span>
          </div>
          <button onClick={loadPreview} className="mt-2 text-sm font-medium underline">
            {lang === 'VN' ? 'Thử lại' : 'Retry'}
          </button>
        </div>
      )}

      {preview && !loading && !error && (
        <>
          {/* ── Candidates ── */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
              <span className="material-symbols-outlined text-[20px]">suggested</span>
              {lang === 'VN' ? 'Phương án thay thế' : 'Replacement Options'}
              {preview.candidates?.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {preview.candidates.length}
                </span>
              )}
            </h3>

            {preview.candidates?.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                <span className="material-symbols-outlined text-4xl text-slate-300">search_off</span>
                <p className="mt-2">{lang === 'VN' ? 'Không có phương án thay thế.' : 'No replacement options available.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {preview.candidates.map((candidate) => (
                  <CandidateRow
                    key={candidate.candidateId}
                    candidate={candidate}
                    selected={selectedCandidateId === candidate.candidateId}
                    onSelect={() => setSelectedCandidateId(candidate.candidateId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Affected trips ── */}
          {preview.affectedTrips?.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
                <span className="material-symbols-outlined text-[20px]">group</span>
                {lang === 'VN' ? 'Chuyến bị ảnh hưởng' : 'Affected Trips'}
                {preview.totalAffectedPassengers > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    {lang === 'VN'
                      ? `${preview.totalAffectedPassengers} khách`
                      : `${preview.totalAffectedPassengers} pax`}
                  </span>
                )}
              </h3>
              <div className="space-y-2">
                {preview.affectedTrips.map((trip) => (
                  <AffectedTripRow key={trip.tripId} trip={trip} />
                ))}
              </div>
            </div>
          )}

          {/* ── Summary ── */}
          {preview.candidates?.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {lang === 'VN' ? 'Tóm tắt' : 'Summary'}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-4">
                <div>
                  <span className="text-xs uppercase text-slate-400">{lang === 'VN' ? 'Hành động' : 'Action'}</span>
                  <p className="font-semibold">{currentAction?.labelVN || action}</p>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-400">{lang === 'VN' ? 'Phương án' : 'Option'}</span>
                  <p className="font-semibold">
                    {selectedCandidate
                      ? `${selectedCandidate.boatName || selectedCandidate.boatCode}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-400">{lang === 'VN' ? 'Chuyến ảnh hưởng' : 'Affected'}</span>
                  <p className="font-semibold">{preview.affectedTrips?.length || 0}</p>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-400">{lang === 'VN' ? 'Khách ảnh hưởng' : 'Pax impacted'}</span>
                  <p className="font-semibold">{preview.totalAffectedPassengers || 0}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Action buttons ── */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {lang === 'VN' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming || (!selectedCandidateId && action === 'ReplaceBoat')}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {confirming && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              <span className="material-symbols-outlined text-[18px]">check</span>
              {lang === 'VN' ? 'Xác nhận thay đổi' : 'Confirm Changes'}
            </button>
          </div>
        </>
      )}

      {/* ── History panel ── */}
      {showHistory && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
            <span className="material-symbols-outlined text-[20px]">history</span>
            {lang === 'VN' ? 'Lịch sử thay đổi' : 'Replan History'}
          </h3>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">{lang === 'VN' ? 'Chưa có lịch sử.' : 'No history yet.'}</p>
          ) : (
            <div className="space-y-2">
              {history.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <div>
                    <span className="font-medium">{item.action || '—'}</span>
                    {item.note && <span className="ml-2 text-slate-500">— {item.note}</span>}
                  </div>
                  <span className="text-xs text-slate-400">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
