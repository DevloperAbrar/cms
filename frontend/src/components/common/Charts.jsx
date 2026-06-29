import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    LineChart,
    Line,
  } from 'recharts';
  
  const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2'];
  
  export const AttendanceBarChart = ({ data }) => (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="subject_code" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [`${value}%`, 'Attendance']}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="percentage" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
  
  export const MarksBarChart = ({ data }) => (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="component_name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Bar dataKey="obtained" fill="#2563eb" name="Obtained" radius={[4, 4, 0, 0]} />
        <Bar dataKey="max_marks" fill="#e5e7eb" name="Max" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
  
  export const PassFailPieChart = ({ passCount, failCount }) => {
    const data = [
      { name: 'Pass', value: passCount },
      { name: 'Fail', value: failCount },
    ];
    return (
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? '#16a34a' : '#dc2626'} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  };
  
  export const SGPALineChart = ({ data }) => (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="semester" tickFormatter={(v) => `Sem ${v}`} tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="sgpa"
          stroke="#2563eb"
          strokeWidth={2}
          dot={{ r: 4, fill: '#2563eb' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );