import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

interface Task {
  _id: string;
  title: string;
  status: string;
  deadline: string | null;
}

export default function CalendarView({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = month.getFullYear();
  const mon = month.getMonth();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const startDay = new Date(year, mon, 1).getDay();

  const tasksByDate = new Map<string, Task[]>();
  tasks.filter(t => t.deadline).forEach(t => {
    const d = new Date(t.deadline!);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!tasksByDate.has(key)) tasksByDate.set(key, []);
    tasksByDate.get(key)!.push(t);
  });

  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === mon && today.getDate() === d;

  const cells: { day: number | null; key: string }[] = [];
  for (let i = 0; i < startDay; i++) cells.push({ day: null, key: `e${i}` });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: `d${d}` });

  return (
    <View>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => setMonth(new Date(year, mon - 1, 1))}>
          <Text style={s.navBtn}>← Prev</Text>
        </TouchableOpacity>
        <Text style={s.monthLabel}>{month.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
        <TouchableOpacity onPress={() => setMonth(new Date(year, mon + 1, 1))}>
          <Text style={s.navBtn}>Next →</Text>
        </TouchableOpacity>
      </View>

      <View style={s.weekRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={s.weekDay}>{d}</Text>
        ))}
      </View>

      <View style={s.grid}>
        {cells.map(({ day, key }) => {
          if (!day) return <View key={key} style={s.cell} />;
          const dateKey = `${year}-${mon}-${day}`;
          const dayTasks = tasksByDate.get(dateKey) || [];
          return (
            <View key={key} style={[s.cell, isToday(day) && s.todayCell]}>
              <Text style={[s.dayNum, isToday(day) && s.todayNum]}>{day}</Text>
              {dayTasks.slice(0, 2).map(t => (
                <TouchableOpacity key={t._id} onPress={() => router.push(`/task/${t._id}`)}>
                  <Text numberOfLines={1} style={[s.taskDot, t.status === 'done' ? s.taskDone : s.taskPending]}>
                    {t.title}
                  </Text>
                </TouchableOpacity>
              ))}
              {dayTasks.length > 2 && <Text style={s.more}>+{dayTasks.length - 2}</Text>}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  navBtn: { color: '#1a73e8', fontSize: 16 },
  monthLabel: { fontWeight: 'bold', fontSize: 16 },
  weekRow: { flexDirection: 'row' },
  weekDay: { flex: 1, textAlign: 'center', fontWeight: 'bold', color: '#888', paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', minHeight: 64, borderWidth: 0.5, borderColor: '#eee', padding: 2 },
  todayCell: { backgroundColor: '#e8f0fe' },
  dayNum: { fontSize: 12, color: '#666', marginBottom: 2 },
  todayNum: { color: '#1a73e8', fontWeight: 'bold' },
  taskDot: { fontSize: 9, paddingHorizontal: 2, paddingVertical: 1, borderRadius: 2, marginBottom: 1, overflow: 'hidden' },
  taskPending: { backgroundColor: '#fff3e0' },
  taskDone: { backgroundColor: '#e8f5e9', textDecorationLine: 'line-through' },
  more: { fontSize: 9, color: '#888' },
});
