import React, { useState, useRef, useEffect, useCallback } from 'react';
import { format, addDays, startOfToday, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { Task } from './types';
import { cn } from './utils/cn';
import { GripVertical, Plus, Calendar, ListTodo, CheckCircle2, Circle, Image as ImageIcon, Trash2, Bell, X, Filter, ArrowUpDown } from 'lucide-react';
import { Rnd } from 'react-rnd';

export default function App() {
  const [leftWidth, setLeftWidth] = useState(50); // percentage
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [notifications, setNotifications] = useState<{id: string, message: string}[]>([]);
  
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'dueDate' | 'creationTime'>('default');

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('planner-tasks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('planner-tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const interval = setInterval(() => {
      const now = new Date();
      let updated = false;
      const newTasks = tasks.map(task => {
        if (!task.isCompleted && !task.notified && task.date && task.ddl) {
          const taskDateTime = new Date(`${task.date}T${task.ddl}`);
          const timeDiff = taskDateTime.getTime() - now.getTime();
          
          // If deadline is within 15 minutes (900000 ms) or has passed (but not older than 1 day)
          if (timeDiff <= 900000 && timeDiff > -86400000) {
            updated = true;
            
            const message = `任务提醒: "${task.content || '未命名任务'}" 即将到期 (${task.ddl})`;
            
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('日程提醒', { body: message });
            }
            
            setNotifications(prev => [...prev, { id: uuidv4(), message }]);
            
            return { ...task, notified: true };
          }
        }
        return task;
      });

      if (updated) {
        setTasks(newTasks);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [tasks]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    // Constrain between 20% and 80%
    if (newLeftWidth > 20 && newLeftWidth < 80) {
      setLeftWidth(newLeftWidth);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    document.body.style.cursor = 'default';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Generate next 14 days
  const today = startOfToday();
  const dates = Array.from({ length: 14 }).map((_, i) => addDays(today, i));

  const addTask = (date: string | null, content: string = '') => {
    const newTask: Task = {
      id: uuidv4(),
      content,
      date,
      isCompleted: false,
      createdAt: Date.now(),
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const getProcessedTasks = (tasksToProcess: Task[]) => {
    let processed = tasksToProcess.filter(t => {
      if (filterStatus === 'pending') return !t.isCompleted;
      if (filterStatus === 'completed') return t.isCompleted;
      return true;
    });

    if (sortBy === 'dueDate') {
      processed.sort((a, b) => {
        if (!a.ddl && !b.ddl) return 0;
        if (!a.ddl) return 1;
        if (!b.ddl) return -1;
        return a.ddl.localeCompare(b.ddl);
      });
    } else if (sortBy === 'creationTime') {
      processed.sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeB - timeA; // Newest first
      });
    }
    return processed;
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id === id) {
        const updatedTask = { ...t, ...updates };
        // Reset notified flag if date or ddl changes
        if (updates.date !== undefined || updates.ddl !== undefined) {
          updatedTask.notified = false;
        }
        return updatedTask;
      }
      return t;
    }));
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      const el = document.getElementById(`task-${taskId}`);
      if (el) el.classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent, taskId: string) => {
    const el = document.getElementById(`task-${taskId}`);
    if (el) el.classList.remove('opacity-50');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, date: string | null) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      updateTask(taskId, { date });
    }
  };

  const renderTask = (task: Task) => (
    <div
      key={task.id}
      id={`task-${task.id}`}
      draggable
      onDragStart={(e) => handleDragStart(e, task.id)}
      onDragEnd={(e) => handleDragEnd(e, task.id)}
      className="group flex flex-col gap-2 p-4 mb-3 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-lg hover:bg-black/40 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => updateTask(task.id, { isCompleted: !task.isCompleted })}
          className="mt-1 text-white/40 hover:text-emerald-400 transition-colors"
        >
          {task.isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>
        <div className="flex-1 flex flex-col gap-2">
          <input
            type="text"
            value={task.content}
            onChange={(e) => updateTask(task.id, { content: e.target.value })}
            placeholder="输入事项..."
            className={cn(
              "bg-transparent border-none outline-none text-lg font-semibold w-full placeholder:text-white/30 transition-colors",
              task.isCompleted ? "line-through text-white/40" : "text-white/90"
            )}
          />
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={task.ddl || ''}
              onChange={(e) => updateTask(task.id, { ddl: e.target.value })}
              className="text-sm font-medium bg-white/5 hover:bg-white/10 rounded-md px-2 py-1 border-none outline-none text-white/60 w-fit transition-colors cursor-pointer"
            />
          </div>
        </div>
        <button
          onClick={() => deleteTask(task.id)}
          className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all p-2 mt-0.5"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div 
      className="h-screen w-full relative overflow-hidden font-sans flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=2500&auto=format&fit=crop")' }}
    >
      <Rnd
        default={{
          x: window.innerWidth / 2 - 450,
          y: window.innerHeight / 2 - 350,
          width: 900,
          height: 700,
        }}
        minWidth={600}
        minHeight={400}
        bounds="parent"
        dragHandleClassName="drag-handle"
        className="z-10"
      >
        {/* Desktop Widget Container */}
        <div className="w-full h-full rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden text-white">
          
          {/* Top Bar - Drag Handle */}
          <div className="drag-handle cursor-move h-14 shrink-0 border-b border-white/10 bg-black/20 flex items-center justify-between px-6 z-20" style={{ WebkitAppRegion: 'drag' } as any}>
            <div className="font-bold text-lg tracking-tight text-white/90 flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-white/30" />
              Planner
            </div>
            <div className="flex items-center gap-4 text-sm" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-white/50" />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-black/50 border border-white/10 rounded-md px-2 py-1 outline-none text-white/90 cursor-pointer font-medium"
              >
                <option value="all">全部状态</option>
                <option value="pending">未完成</option>
                <option value="completed">已完成</option>
              </select>
            </div>
            <div className="w-px h-4 bg-white/20"></div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-white/50" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-black/50 border border-white/10 rounded-md px-2 py-1 outline-none text-white/90 cursor-pointer font-medium"
              >
                <option value="default">默认排序</option>
                <option value="dueDate">按截止时间</option>
                <option value="creationTime">按创建时间</option>
              </select>
            </div>
            </div>
          </div>

          <div ref={containerRef} className="flex-1 flex w-full relative z-10 min-h-0">
          
          {/* Left Panel: Dates */}
          <div
            style={{ width: `${leftWidth}%` }}
            className="h-full flex flex-col border-r border-white/10 bg-black/10"
          >
            <div className="p-5 border-b border-white/10 flex items-center gap-3 bg-black/20 sticky top-0 z-10 shadow-sm">
              <div className="p-2 bg-white/10 rounded-xl">
                <Calendar className="w-5 h-5 text-white/90" />
              </div>
              <h2 className="font-bold text-xl tracking-tight text-white/90">日程安排</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar min-h-0">
              {dates.map((date) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const dayTasks = getProcessedTasks(tasks.filter((t) => t.date === dateStr));
                const isToday = dateStr === format(today, 'yyyy-MM-dd');

                return (
                  <div
                    key={dateStr}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, dateStr)}
                    className={cn(
                      "rounded-3xl border p-5 transition-all duration-300",
                      isToday
                        ? "bg-white/10 border-white/30 shadow-lg"
                        : "bg-black/20 border-white/10 hover:bg-black/30 shadow-sm"
                    )}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-baseline gap-2">
                        <h3 className={cn(
                          "text-xl font-bold tracking-tight",
                          isToday ? "text-white" : "text-white/90"
                        )}>
                          {format(date, 'M月d日')}
                        </h3>
                        <span className="text-sm font-medium text-white/50">
                          {format(date, 'EEEE', { locale: zhCN })}
                        </span>
                      </div>
                      <button
                        onClick={() => addTask(dateStr)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all shadow-sm text-white/90 hover:scale-105 active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="min-h-[60px]">
                      {dayTasks.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm text-white/30 italic border-2 border-dashed border-white/10 rounded-2xl py-6">
                          拖拽或点击右上角添加事项
                        </div>
                      ) : (
                        dayTasks.map(renderTask)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resizer */}
          <div
            className="w-2 hover:w-3 bg-transparent hover:bg-white/10 cursor-col-resize transition-all flex items-center justify-center group z-20 -ml-1 -mr-1"
            onMouseDown={handleMouseDown}
          >
            <div className="h-12 w-1 rounded-full bg-white/20 group-hover:bg-white/50 transition-colors" />
          </div>

          {/* Right Panel: Unscheduled */}
          <div
            style={{ width: `${100 - leftWidth}%` }}
            className="h-full flex flex-col bg-black/5"
          >
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/20 sticky top-0 z-10 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <ListTodo className="w-5 h-5 text-white/90" />
                </div>
                <h2 className="font-bold text-xl tracking-tight text-white/90">待安排</h2>
              </div>
              <button
                onClick={() => addTask(null)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all shadow-sm text-white/90 hover:scale-105 active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, null)}
            >
              <div className="min-h-full">
                {getProcessedTasks(tasks.filter((t) => t.date === null)).map(renderTask)}
                {getProcessedTasks(tasks.filter((t) => t.date === null)).length === 0 && (
                  <div className="h-40 flex flex-col items-center justify-center text-white/30 gap-3">
                    <div className="p-4 bg-black/20 rounded-2xl">
                      <ListTodo className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="text-sm font-medium">暂无待安排事项</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      </Rnd>

      {/* Notifications Toast */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        {notifications.map(n => (
          <div key={n.id} className="bg-black/80 backdrop-blur-xl shadow-2xl rounded-2xl p-4 border border-white/20 flex items-center gap-4 transition-all animate-in slide-in-from-right text-white">
            <div className="p-2 bg-white/10 rounded-full">
              <Bell className="w-5 h-5 text-white/90 animate-bounce" />
            </div>
            <p className="text-sm font-medium">{n.message}</p>
            <button
              onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
              className="text-white/50 hover:text-white p-1.5 hover:bg-white/10 rounded-full transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
