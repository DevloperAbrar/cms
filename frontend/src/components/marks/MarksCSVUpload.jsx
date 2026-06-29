import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const MarksCSVUpload = ({ onUpload, isLoading }) => {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await onUpload(fd);
      setResult(res);
      toast.success(`${res?.imported || 0} records imported`);
      setFile(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="btn-secondary cursor-pointer">
          <Upload className="h-4 w-4" />
          {file ? file.name : 'Select CSV'}
          <input type="file" accept=".csv" className="hidden" onChange={(e) => { setFile(e.target.files[0]); setResult(null); }} />
        </label>
        {file && (
          <button className="btn-primary" onClick={handleUpload} disabled={isLoading}>
            {isLoading ? 'Uploading...' : 'Upload'}
          </button>
        )}
      </div>

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            {result.imported} records imported successfully
          </div>
          {result.errors?.length > 0 && (
            <div className="border border-red-200 rounded-lg p-3 bg-red-50">
              <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> {result.errors.length} rows had errors
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">
                    {e.enrollment_no}: {e.error}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};