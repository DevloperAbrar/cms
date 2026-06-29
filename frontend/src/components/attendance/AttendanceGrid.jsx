import { getAttendanceColor } from '../../utils/gradeCalculator';

export const AttendanceGrid = ({ data = [], showStudent = false }) => {
  if (!data.length) return <p className="text-sm text-gray-500 py-8 text-center">No attendance data available.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {showStudent && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>}
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Subject</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Present</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Absent</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">%</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {showStudent && <td className="px-4 py-3 font-medium">{row.student_name}</td>}
              <td className="px-4 py-3">{row.subject_name || row.subject_code}</td>
              <td className="px-4 py-3">{row.total}</td>
              <td className="px-4 py-3 text-green-700">{row.present}</td>
              <td className="px-4 py-3 text-red-700">{row.absent}</td>
              <td className={`px-4 py-3 font-semibold ${getAttendanceColor(row.percentage)}`}>
                {row.percentage}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};