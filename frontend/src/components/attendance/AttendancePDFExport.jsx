import { Download } from 'lucide-react';
import toast from 'react-hot-toast';

export const AttendancePDFExport = ({ studentId, studentName }) => {
  const handleExport = async () => {
    try {
      const baseURL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(
        `${baseURL}/hod/students/${studentId}/attendance/pdf`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${studentName || studentId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('PDF export failed: ' + e.message);
    }
  };

  return (
    <button className="btn-secondary btn-sm flex items-center gap-1.5" onClick={handleExport}>
      <Download className="h-3.5 w-3.5" /> Export PDF
    </button>
  );
};