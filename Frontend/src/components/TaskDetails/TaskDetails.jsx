import React, { useEffect, useState, useCallback } from 'react';
import './TaskDetails.css';

const TaskDetails = () => {
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(localStorage.getItem('lastSelectedTask') || null);
  const [startTime, setStartTime] = useState('2024-10-01T12:00');
  const [endTime, setEndTime] = useState(getEndOfDayTime());
  const [activityIntervals, setActivityIntervals] = useState([]);
  const [newInterval, setNewInterval] = useState({ start: '', stop: '' });
  const [error, setError] = useState(null);
  const [debounceTimeout, setDebounceTimeout] = useState(null);

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

  // Debounced fetch for activity intervals
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
          isNew: false,
          isModified: false,
          isOngoing: true,
          hasOverlap: false,
        });
      }

      filteredIntervals.sort((a, b) => a.start - b.start);
      setActivityIntervals(checkForOverlaps(filteredIntervals));
    } catch (err) {
      setError(err.message);
    }
  }, [selectedTaskId, startTime, endTime]);

  // Apply debounce to interval fetching
  useEffect(() => {
    if (!selectedTaskId) return;
    if (debounceTimeout) clearTimeout(debounceTimeout);

    const timeout = setTimeout(() => {
      fetchActivityIntervals();
    }, 300);

    setDebounceTimeout(timeout);
    return () => clearTimeout(timeout);
  }, [selectedTaskId, startTime, endTime, fetchActivityIntervals]);

  // Fetch tasks once on mount
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

  // Handle adding a new interval
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
      { id: Date.now(), start, stop, isNew: true, isModified: false, hasOverlap: false }
    ].sort((a, b) => a.start - b.start);

    setActivityIntervals(checkForOverlaps(updatedIntervals));
    setNewInterval({ start: '', stop: '' });
  };

  // Handle editing interval times
  const handleEditInterval = (index, field, value) => {
    const updatedIntervals = [...activityIntervals];
    updatedIntervals[index][field] = new Date(value);
    updatedIntervals[index].isModified = true;

    setActivityIntervals(checkForOverlaps(updatedIntervals.sort((a, b) => a.start - b.start)));
  };

  // Handle saving changes to the backend
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

  // Handle deleting an interval
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
        <label>Select Task:</label>
        <select
          value={selectedTaskId || ''}
          onChange={(e) => handleTaskChange(e.target.value)}
        >
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.name}
            </option>
          ))}
        </select>

        <div>
          <label>Start Time: </label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <label>End Time: </label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
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
                  />
                </td>
                <td>
                  {interval.stop ? (
                    <input
                      type="datetime-local"
                      value={formatToLocalDateTime(interval.stop)}
                      onChange={(e) => handleEditInterval(index, 'stop', e.target.value)}
                    />
                  ) : (
                    <span>Ongoing</span>
                  )}
                </td>
                <td>
                  <button onClick={() => handleDeleteInterval(index)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Add New Interval</h3>
        <div className="new-interval-inputs">
          <label>Start: </label>
          <input
            type="datetime-local"
            value={newInterval.start}
            onChange={(e) => setNewInterval({ ...newInterval, start: e.target.value })}
          />
          <label>Stop: </label>
          <input
            type="datetime-local"
            value={newInterval.stop}
            onChange={(e) => setNewInterval({ ...newInterval, stop: e.target.value })}
          />
          <button onClick={handleAddInterval}>Add Interval</button>
        </div>

        <button onClick={saveChanges}>Save Changes</button>
      </main>
    </div>
  );
};

export default TaskDetails;
