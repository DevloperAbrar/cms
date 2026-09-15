import { useState } from 'react';

export default function PurgeModal({ college, onClose, onSubmit }) {
  const [confirmCode, setConfirmCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (confirmCode !== college.code) {
      setError('College code does not match.');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(college.id, confirmCode);
    } catch (err) {
      setError(err.response?.data?.message || 'Purge failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-red-900 rounded-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-red-900/50">
          <h2 className="font-semibold text-red-400">⚠️ Permanently Purge College</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-400">
            This will <span className="text-red-400 font-semibold">permanently delete all data</span> for{' '}
            <span className="text-white font-medium">{college.name}</span>. This cannot be undone.
          </p>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Type college code <span className="text-white font-mono">{college.code}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              placeholder={college.code}
              className="w-full bg-gray-800 border border-red-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || confirmCode !== college.code}
              className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {loading ? 'Purging...' : 'Purge Permanently'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}