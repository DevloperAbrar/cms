import { Download } from 'lucide-react';
import { downloadBlob } from '../../utils/csvTemplateGenerator';
import toast from 'react-hot-toast';

export const CSVTemplateDownload = ({ onDownload, filename = 'marks_template.csv', label = 'Download Template' }) => {
  const handleDownload = async () => {
    try {
      const res = await onDownload();
      downloadBlob(res.data || res, filename);
    } catch (e) {
      toast.error('Template download failed: ' + e.message);
    }
  };

  return (
    <button className="btn-secondary" onClick={handleDownload}>
      <Download className="h-4 w-4" /> {label}
    </button>
  );
};