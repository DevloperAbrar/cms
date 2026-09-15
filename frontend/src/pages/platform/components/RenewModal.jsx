import { useState } from 'react';

export default function RenewModal({ college, onClose, onSubmit }) {
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(college.id, Number(months));
    } finally {
      setLoading(false);
    }
  };

  const base = college.subscriptionEnd > new Date() ? new Date(college.subscriptionEnd) : new Date();
  const newEnd = new Date(base);
  newEnd.setMonth(newEnd.getMonth() + Number(months));

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">Renew Subscription</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-400">
            Renewing <span className="text-white font-medium">{college.name}</span>
          </p>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Duration (months)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="text-xs text-gray-500">
            New expiry: <span className="text-green-400">{newEnd.toLocaleDateString('en-IN')}</span>
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {loading ? 'Renewing...' : 'Renew'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}