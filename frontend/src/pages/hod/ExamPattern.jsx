import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hodApi } from '../../api/hod.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Plus, Trash2, Save } from 'lucide-react';

const ENTERED_BY_OPTIONS = ['faculty', 'coordinator', 'exam_controller'];

const emptyComponent = () => ({
  name: '',
  max_marks: '',
  weightage_percent: '',
  entered_by: 'faculty',
  pass_marks: 0,
  include_in_sgpa: true,
});

const HODExamPatternPage = () => {
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({ year: '', semester: '' });
  const [components, setComponents] = useState([emptyComponent()]);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filtersReady = !!filters.year && !!filters.semester;

  const {
    data: patternData,
    isLoading: fetching,
    status,
    fetchStatus,
  } = useQuery({
    queryKey: ['hod-exam-pattern', filters.year, filters.semester],
    queryFn: () => hodApi.getExamPattern({ year: filters.year, semester: filters.semester }),
    enabled: filtersReady,
    retry: false,
    // Don't throw on error — handle it ourselves
    throwOnError: false,
  });

  // When data arrives — populate components
  useEffect(() => {
    if (!filtersReady) return;
    if (status === 'success') {
      const comps = patternData?.data?.components || patternData?.components || [];
      if (comps.length > 0) {
        setComponents(
          comps.map((c) => ({
            name: c.name,
            max_marks: c.max_marks,
            weightage_percent: c.weightage_percent,
            entered_by: c.entered_by,
            pass_marks: c.pass_marks ?? 0,
            include_in_sgpa: c.include_in_sgpa ?? true,
          }))
        );
      } else {
        // Pattern exists but no components — show one empty row
        setComponents([emptyComponent()]);
      }
    } else if (status === 'error') {
      // 404 or any error — start fresh
      setComponents([emptyComponent()]);
    }
  }, [status, patternData, filters.year, filters.semester]);

  const handleFilterChange = (field, value) => {
    setComponents([emptyComponent()]);
    setFilters((p) => ({ ...p, [field]: value }));
  };

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (data) => hodApi.upsertExamPattern(data),
    onSuccess: () => {
      showToast('Exam pattern saved.');
      queryClient.invalidateQueries({ queryKey: ['hod-exam-pattern'] });
    },
    onError: (err) => showToast(err?.response?.data?.message || 'Save failed.', 'error'),
  });

  const totalWeightage = components.reduce((s, c) => s + (Number(c.weightage_percent) || 0), 0);
  const weightageOk = Math.round(totalWeightage) === 100;

  const updateComponent = (i, field, value) =>
    setComponents((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));

  const addComponent = () => setComponents((prev) => [...prev, emptyComponent()]);

  const removeComponent = (i) =>
    setComponents((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = () => {
    if (!filters.year || !filters.semester)
      return showToast('Select year and semester first.', 'error');
    const invalid = components.some((c) => !c.name || c.max_marks === '' || c.weightage_percent === '');
    if (invalid) return showToast('Fill all component fields.', 'error');
    if (!weightageOk)
      return showToast(`Weightages must sum to 100. Current: ${totalWeightage}.`, 'error');
    save({
      year: Number(filters.year),
      semester: Number(filters.semester),
      components: components.map((c) => ({
        ...c,
        max_marks: Number(c.max_marks),
        weightage_percent: Number(c.weightage_percent),
        pass_marks: Number(c.pass_marks) || 0,
      })),
    });
  };

  const isLoading = filtersReady && fetching && fetchStatus === 'fetching';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Exam Pattern"
        description="Configure marks components for your department's stream"
      />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg text-white ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <div>
            <label className="label">Year</label>
            <select
              className="input"
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
            >
              <option value="">Select Year</option>
              {[1, 2, 3, 4, 5, 6].map((y) => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Semester</label>
            <select
              className="input"
              value={filters.semester}
              onChange={(e) => handleFilterChange('semester', e.target.value)}
            >
              <option value="">Select Semester</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {!filtersReady ? (
        <div className="card p-10 text-center text-gray-400 text-sm">
          Select year and semester to configure the exam pattern.
        </div>
      ) : isLoading ? (
        <LoadingSpinner className="py-16" />
      ) : (
        <div className="card p-4 space-y-4">
          {/* Info banner when creating new */}
          {status === 'error' && (
            <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              No pattern found for Year {filters.year} Sem {filters.semester} — creating new.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
                  <th className="pb-2 pr-3 min-w-[180px]">Component Name</th>
                  <th className="pb-2 pr-3">Max Marks</th>
                  <th className="pb-2 pr-3">Weightage %</th>
                  <th className="pb-2 pr-3">Entered By</th>
                  <th className="pb-2 pr-3">Pass Marks</th>
                  <th className="pb-2 pr-3">In SGPA</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {components.map((c, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3">
                      <input
                        className="input"
                        placeholder="e.g. MID SEM 1"
                        value={c.name}
                        onChange={(e) => updateComponent(i, 'name', e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        className="input w-24"
                        type="number"
                        min="0"
                        placeholder="20"
                        value={c.max_marks}
                        onChange={(e) => updateComponent(i, 'max_marks', e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        className="input w-24"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="10"
                        value={c.weightage_percent}
                        onChange={(e) => updateComponent(i, 'weightage_percent', e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        className="input"
                        value={c.entered_by}
                        onChange={(e) => updateComponent(i, 'entered_by', e.target.value)}
                      >
                        {ENTERED_BY_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        className="input w-24"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={c.pass_marks}
                        onChange={(e) => updateComponent(i, 'pass_marks', e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={c.include_in_sgpa}
                        onChange={(e) => updateComponent(i, 'include_in_sgpa', e.target.checked)}
                      />
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => removeComponent(i)}
                        className="text-red-400 hover:text-red-600 p-1"
                        disabled={components.length === 1}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <button
              onClick={addComponent}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={15} /> Add Component
            </button>

            <div className="flex items-center gap-4">
              <span
                className={`text-sm font-medium ${
                  weightageOk ? 'text-green-600' : 'text-red-500'
                }`}
              >
                Total Weightage: {totalWeightage}%
                {!weightageOk && ' (must be 100%)'}
              </span>
              <button
                onClick={handleSave}
                disabled={saving || !weightageOk}
                className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save size={15} />
                {saving ? 'Saving…' : 'Save Pattern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODExamPatternPage;