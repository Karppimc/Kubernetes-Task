import React, { useEffect, useState, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart, LinearScale, CategoryScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import './TaskDetails.css';

Chart.register(LinearScale, CategoryScale, BarElement, Title, Tooltip, Legend);

const TaskDetails = () => {
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(localStorage.getItem('lastSelectedTask') || null);
  const [startTime, setStartTime] = useState('2024-10-01T12:00');
  const [endTime, setEndTime] = useState(getEndOfDayTime());
  const [activityIntervals, setActivityIntervals] = useState([]);
  const [newInterval, setNewInterval] = useState({ start: '', stop: '' });
  const [error, setError] = useState(null);
  const [debounceTimeout, setDebounceTimeout] = useState(null);
  const [dailyActiveTimes, setDailyActiveTimes] = useState({});

  // Helper functions
  function getEndOfDayTime() {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 0, 0);
    endOfDay.setMinutes(endOfDay.getMinutes() - endOfDay.getTimezoneOffset());
    return endOfDay.toISOString().slice(0, 16);
  }

  function formatToLocalDateTime(date) {
    const adjustedDate = new Date(date);
    adjustedDate.setMinutes(adjustedDate.getMinutes() - adjustedDate.getTimezoneOffset());
    return adjustedDate.toISOString().slice(0, 16);
  }

  // Calculate daily active times from intervals
  const calculateDailyActiveTimes = () => {
    const dailySummary = {};

    const taskIntervals = activityIntervals.filter(interval => interval.taskId === Number(selectedTaskId));

    taskIntervals.forEach((interval) => {
      if (!interval.stop) return;

      const startDate = new Date(interval.start);
      const stopDate = new Date(interval.stop);
      let currentDate = new Date(startDate);

      console.log(`Processing interval from ${startDate} to ${stopDate}`);

      while (currentDate <= stopDate) {
        const dayKey = currentDate.toISOString().slice(0, 10);

        let timeSpent;
        if (currentDate.toDateString() === startDate.toDateString()) {
          timeSpent = (new Date(dayKey + 'T23:59:59') - startDate) / (1000 * 60 * 60);
        } else if (currentDate.toDateString() === stopDate.toDateString()) {
          timeSpent = (stopDate - new Date(dayKey + 'T00:00:00')) / (1000 * 60 * 60);
        } else {
          timeSpent = 24;
        }

        dailySummary[dayKey] = (dailySummary[dayKey] || 0) + timeSpent;

        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
      }
    });

    setDailyActiveTimes(dailySummary);
  };

  const fetchActivityIntervals = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3010/timestamps');
      if (!response.ok) throw new Error('Failed to fetch timestamps');
      const timestamps = await response.json();

      const start = new Date(startTime);
      const end = new Date(endTime);

      const filteredIntervals = [];
      let currentStart = null;

      timestamps
        .filter(
          (timestamp) =>
            timestamp.task === Number(selectedTaskId) &&
            new Date(timestamp.timestamp) >= start &&
            new Date(timestamp.timestamp) <= end
        )
        .forEach((timestamp) => {
          const timestampDate = new Date(timestamp.timestamp);
          if (timestamp.type === 0) {
            currentStart = timestampDate;
          } else if (timestamp.type === 1 && currentStart) {
            filteredIntervals.push({
              id: timestamp.id,
              start: currentStart,
              stop: timestampDate,
              taskId: timestamp.task,
              startId: timestamp.id - 1,
              stopId: timestamp.id,
              isNew: false,
              isModified: false,
              hasOverlap: false,
            });
            currentStart = null;
          }
        });

      if (currentStart && new Date() < new Date(endTime)) {
        filteredIntervals.push({
          id: Date.now(),
          start: currentStart,
          stop: null,
          taskId: selectedTaskId,
          isNew: false,
          isModified: false,
          isOngoing: true,
          hasOverlap: false,
        });
      }

      filteredIntervals.sort((a, b) => a.start - b.start);
      console.log("Filtered Activity Intervals:", filteredIntervals);
      setActivityIntervals(checkForOverlaps(filteredIntervals));
    } catch (err) {
      setError(err.message);
    }
  }, [selectedTaskId, startTime, endTime]);

  useEffect(() => {
    if (activityIntervals.length > 0) {
      calculateDailyActiveTimes();
    }
  }, [activityIntervals]);

  useEffect(() => {
    if (!selectedTaskId) return;
    if (debounceTimeout) clearTimeout(debounceTimeout);

    const timeout = setTimeout(() => {
      fetchActivityIntervals();
    }, 300);

    setDebounceTimeout(timeout);
    return () => clearTimeout(timeout);
  }, [selectedTaskId, startTime, endTime, fetchActivityIntervals]);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch('http://localhost:3010/tasks');
        if (!response.ok) throw new Error('Failed to fetch tasks');
        const tasksData = await response.json();
        setTasks(tasksData);

        if (!selectedTaskId && tasksData.length > 0) {
          const defaultTaskId = tasksData[0].id;
          setSelectedTaskId(defaultTaskId);
          localStorage.setItem('lastSelectedTask', defaultTaskId);
        }
      } catch (err) {
        setError(err.message);
      }
    };
    fetchTasks();
  }, []);

  const handleTaskChange = (taskId) => {
    setSelectedTaskId(taskId);
    localStorage.setItem('lastSelectedTask', taskId);
  };

  const checkForOverlaps = (intervals) => {
    const updatedIntervals = intervals.map((interval, index, array) => {
      if (index > 0 && array[index - 1].stop > interval.start) {
        interval.hasOverlap = true;
        array[index - 1].hasOverlap = true;
      }
      return interval;
    });
    return updatedIntervals;
  };

  const handleAddInterval = () => {
    if (!newInterval.start || !newInterval.stop) {
      setError('Please enter both start and stop times for the new interval.');
      return;
    }

    const start = new Date(newInterval.start);
    const stop = new Date(newInterval.stop);
    if (start >= stop) {
      setError('Start time must be before stop time.');
      return;
    }

    const updatedIntervals = [
      ...activityIntervals,
      { id: Date.now(), start, stop, taskId: selectedTaskId, isNew: true, isModified: false, hasOverlap: false }
    ].sort((a, b) => a.start - b.start);

    setActivityIntervals(checkForOverlaps(updatedIntervals));
    setNewInterval({ start: '', stop: '' });
  };

  const handleEditInterval = (index, field, value) => {
    const updatedIntervals = [...activityIntervals];
    updatedIntervals[index][field] = new Date(value);
    updatedIntervals[index].isModified = true;

    setActivityIntervals(checkForOverlaps(updatedIntervals.sort((a, b) => a.start - b.start)));
  };

  const saveChanges = async () => {
    try {
      for (const interval of activityIntervals) {
        if (interval.isNew) {
          await fetch('http://localhost:3010/timestamps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: selectedTaskId, timestamp: interval.start.toISOString(), type: 0 }),
          });
          await fetch('http://localhost:3010/timestamps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: selectedTaskId, timestamp: interval.stop.toISOString(), type: 1 }),
          });
        } else if (interval.isModified) {
          await fetch(`http://localhost:3010/timestamps/${interval.startId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: selectedTaskId, timestamp: interval.start.toISOString(), type: 0 }),
          });
          await fetch(`http://localhost:3010/timestamps/${interval.stopId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: selectedTaskId, timestamp: interval.stop.toISOString(), type: 1 }),
          });
        }
      }

      setError(null);
      fetchActivityIntervals();
    } catch (error) {
      setError('Failed to save changes');
    }
  };

  const handleDeleteInterval = async (index) => {
    const intervalToDelete = activityIntervals[index];
    if (!intervalToDelete.isNew) {
      try {
        await fetch(`http://localhost:3010/timestamps/${intervalToDelete.startId}`, { method: 'DELETE' });
        await fetch(`http://localhost:3010/timestamps/${intervalToDelete.stopId}`, { method: 'DELETE' });
      } catch (error) {
        setError('Failed to delete interval');
        return;
      }
    }

    const updatedIntervals = activityIntervals.filter((_, i) => i !== index);
    setActivityIntervals(checkForOverlaps(updatedIntervals));
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h2>Task Details</h2>
      </header>
      <main className="details-main">
        <label htmlFor="task-select">Select Task:</label>
        <select
          id="task-select"
          value={selectedTaskId || ''}
          onChange={(e) => handleTaskChange(e.target.value)}
          aria-label="Select task to view details"
        >
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.name}
            </option>
          ))}
        </select>

        <div>
          <label htmlFor="start-time">Start Time: </label>
          <input
            id="start-time"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            aria-label="Set start time for activity intervals"
          />
          <label htmlFor="end-time">End Time: </label>
          <input
            id="end-time"
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            aria-label="Set end time for activity intervals"
          />
        </div>

        {error && <p className="error-message">{error}</p>}

        <h3>Activity Intervals</h3>
        <table className="details-table">
          <thead>
            <tr>
              <th>Start</th>
              <th>Stop</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activityIntervals.map((interval, index) => (
              <tr key={interval.id} className={`${interval.hasOverlap ? 'overlap' : ''}`}>
                <td>
                  <input
                    type="datetime-local"
                    value={formatToLocalDateTime(interval.start)}
                    onChange={(e) => handleEditInterval(index, 'start', e.target.value)}
                    aria-label={`Edit start time for interval ${index + 1}`}
                  />
                </td>
                <td>
                  {interval.stop ? (
                    <input
                      type="datetime-local"
                      value={formatToLocalDateTime(interval.stop)}
                      onChange={(e) => handleEditInterval(index, 'stop', e.target.value)}
                      aria-label={`Edit stop time for interval ${index + 1}`}
                    />
                  ) : (
                    <span>Ongoing</span>
                  )}
                </td>
                <td>
                  <button onClick={() => handleDeleteInterval(index)} aria-label={`Delete interval ${index + 1}`}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Daily Active Times</h3>
        <Bar
          data={{
            labels: Object.keys(dailyActiveTimes),
            datasets: [
              {
                label: 'Active Time (Hours and Minutes)',
                data: Object.values(dailyActiveTimes).map((time) => {
                  const hours = Math.floor(time);
                  const minutes = Math.round((time - hours) * 60);
                  return hours + minutes / 60;
                }),
                backgroundColor: 'rgba(100, 149, 237, 0.7)',
              },
            ],
          }}
          options={{
            scales: {
              y: {
                beginAtZero: true,
                title: { display: true, text: 'Hours', color: 'black' },
                ticks: { color: 'black' },
              },
              x: {
                title: { display: true, text: 'Date', color: 'black' },
                ticks: { color: 'black' },
              },
            },
            plugins: {
              legend: { labels: { color: 'black' } },
              title: { display: true, text: 'Daily Active Times', color: 'black' },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const time = context.raw;
                    const hours = Math.floor(time);
                    const minutes = Math.round((time - hours) * 60);
                    return `${hours}h ${minutes}m`;
                  },
                },
              },
            },
          }}
        />

        <h3>Add New Interval</h3>
        <div className="new-interval-inputs">
          <label htmlFor="new-interval-start">Start: </label>
          <input
            id="new-interval-start"
            type="datetime-local"
            value={newInterval.start}
            onChange={(e) => setNewInterval({ ...newInterval, start: e.target.value })}
            aria-label="Set start time for new interval"
          />
          <label htmlFor="new-interval-stop">Stop: </label>
          <input
            id="new-interval-stop"
            type="datetime-local"
            value={newInterval.stop}
            onChange={(e) => setNewInterval({ ...newInterval, stop: e.target.value })}
            aria-label="Set stop time for new interval"
          />
          <button onClick={handleAddInterval} aria-label="Add new interval">Add Interval</button>
        </div>

        <button onClick={saveChanges} aria-label="Save all changes to intervals">Save Changes</button>
      </main>
    </div>
  );
};

export default TaskDetails;