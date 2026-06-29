import { useQuery } from '@tanstack/react-query';
import { studentApi } from '../../api/student.api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const StudentTimetable = () => {
  const { data: timetable, isLoading } = useQuery({
    queryKey: ['student-timetable'],
    queryFn: () => studentApi.getTimetable({}),
  });

  if (isLoading) return <LoadingSpinner className="py-16" />;

  const slots = timetable?.slots || [];
  const slotsByDay = DAYS.reduce((acc, day) => {
    acc[day] = slots.filter((s) => s.day === day).sort((a, b) => a.time_slot.localeCompare(b.time_slot));
    return acc;
  }, {});

  const today = DAYS[new Date().getDay() - 1];

  return (
    <div className="space-y-6">
      <PageHeader title="My Timetable" />

      {!timetable ? (
        <EmptyState title="No timetable published" description="Your timetable has not been published yet." />
      ) : (
        <div className="space-y-4">
          {DAYS.map((day) => {
            const daySlos = slotsByDay[day];
            if (!daySlos.length) return null;
            return (
              <div key={day} className={`card overflow-hidden ${day === today ? 'ring-2 ring-primary-400' : ''}`}>
                <div className={`px-5 py-3 border-b border-gray-200 flex items-center justify-between ${day === today ? 'bg-primary-50' : 'bg-gray-50'}`}>
                  <h3 className={`text-sm font-semibold ${day === today ? 'text-primary-700' : 'text-gray-700'}`}>{day}</h3>
                  {day === today && <span className="badge bg-primary-100 text-primary-700">Today</span>}
                </div>
                <div className="divide-y divide-gray-100">
                  {daySlos.map((slot, i) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-4">
                      <span className="text-xs text-gray-500 w-28 flex-shrink-0">{slot.time_slot}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{slot.subject_id?.name}</p>
                        <p className="text-xs text-gray-500">{slot.faculty_id?.name} {slot.room ? `• Room ${slot.room}` : ''}</p>
                      </div>
                      {slot.is_lab && <span className="badge bg-violet-100 text-violet-700">Lab</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentTimetable;