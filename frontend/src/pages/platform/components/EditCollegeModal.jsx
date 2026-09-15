import { useState } from 'react';

export default function EditCollegeModal({ college, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: college.name || '',
    code: college.code || '',
    contactEmail: college.contactEmail || '',
    contactPhone: college.contactPhone || '',
    subscriptionPlan: college.subscriptionPlan || 'standard',
  });
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit(college.id, form, newPassword.trim() || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update college');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">Edit College</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">College Info</p>

          {[
            { label: 'College Name', field: 'name', placeholder: 'ABC Engineering College', required: true },
            { label: 'College Code (URL slug)', field: 'code', placeholder: 'abc-college', required: true },
            { label: 'Contact Email', field: 'contactEmail', placeholder: 'contact@abc.edu', required: true },
            { label: 'Contact Phone', field: 'contactPhone', placeholder: '+91 9XXXXXXXXX' },
          ].map(({ label, field, placeholder, required }) => (
            <div key={field}>
              <label className="block text-sm text-gray-400 mb-1">{label}</label>
              <input
                type={field.includes('Email') ? 'email' : 'text'}
                required={required}
                value={form[field]}
                onChange={handle(field)}
                placeholder={placeholder}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}

          {form.code !== college.code && (
            <p className="text-xs text-yellow-400">
              Changing the college code changes the login code the college's superadmin must
              use, make sure to tell them the new one.
            </p>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Plan</label>
            <select
              value={form.subscriptionPlan}
              onChange={handle('subscriptionPlan')}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="standard">Standard</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium pt-2">
            Superadmin Password
          </p>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              New Password <span className="text-gray-600">(leave blank to keep unchanged)</span>
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300"
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}