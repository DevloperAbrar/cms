import { useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axiosInstance';

export const QuestionImageUpload = ({ questionId, currentPath, apiBase = 'faculty', onUploaded }) => {
  const [preview, setPreview] = useState(currentPath || null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post(`/${apiBase}/quizzes/image/${questionId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const path = res.data?.image_path || res.image_path;
      setPreview(path);
      onUploaded?.(path);
      toast.success('Image uploaded');
    } catch (e) {
      toast.error('Upload failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {preview && (
        <div className="relative">
          <img
            src={`/api/static/quiz/${preview.split('/').pop()}`}
            alt="Question"
            className="h-16 w-16 object-cover rounded-lg border border-gray-200"
          />
          <button
            type="button"
            onClick={() => { setPreview(null); onUploaded?.(null); }}
            className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full flex items-center justify-center"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
      <label className="btn-secondary btn-sm cursor-pointer">
        <ImagePlus className="h-3.5 w-3.5" />
        {loading ? 'Uploading...' : 'Add Image'}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} disabled={loading} />
      </label>
    </div>
  );
};