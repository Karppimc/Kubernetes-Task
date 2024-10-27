import React, { useEffect, useState } from 'react';
import './TimeSummary.css';

const TimeSummary = () => {
  const [tasks, setTasks] = useState([]);
  const [tags, setTags] = useState({});
  const [startTime, setStartTime] = useState('2024-10-01T12:00');
  const [endTime, setEndTime] = useState(getLocalTime());
  const [taskSummary, setTaskSummary] = useState([]);
  const [tagSummary, setTagSummary] = useState([]);
  const [error, setError] = useState(null);

  function getLocalTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  const handleStartTimeChange = (event) => {
    setStartTime(event.target.value);
  };

  const handleEndTimeChange = (event) => {
    setEndTime(event.target.value);
  };

  const calculateTaskSummary = (timestamps, tasksList) => {
    const taskTimes = {};
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    timestamps
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .forEach((timestamp) => {
        const timestampDate = new Date(timestamp.timestamp);
        if (timestampDate < startDate || timestampDate > endDate) return;

        const taskId = timestamp.task;
        if (!taskTimes[taskId]) {
          taskTimes[taskId] = { totalTime: 0, lastStart: null };
        }

        if (timestamp.type === 0) {
          taskTimes[taskId].lastStart = timestampDate;
        } else if (timestamp.type === 1 && taskTimes[taskId].lastStart) {
          taskTimes[taskId].totalTime += (timestampDate - taskTimes[taskId].lastStart) / 1000 / 60 / 60;
          taskTimes[taskId].lastStart = null;
        }
      });

    const summary = Object.keys(taskTimes).map((taskId) => {
      const totalTime = taskTimes[taskId].totalTime;
      const hours = Math.floor(totalTime);
      const minutes = Math.round((totalTime - hours) * 60);
      const task = tasksList.find((t) => t.id === Number(taskId));

      return {
        id: taskId,
        name: task ? task.name : `Task ${taskId}`,
        totalTime: `${hours}h ${minutes}m`,
      };
    });
    setTaskSummary(summary);
  };

  const calculateTagSummary = (timestamps, tasksList, tagsMap) => {
    const tagTimes = {};
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    timestamps
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .forEach((timestamp) => {
        const timestampDate = new Date(timestamp.timestamp);
        if (timestampDate < startDate || timestampDate > endDate) return;

        const task = tasksList.find((t) => t.id === timestamp.task);
        if (!task || !task.tags) return;

        task.tags.split(',').forEach((tagId) => {
          tagId = tagId.trim();
          if (!tagTimes[tagId]) {
            tagTimes[tagId] = { totalTime: 0, lastStart: null };
          }

          if (timestamp.type === 0) {
            tagTimes[tagId].lastStart = timestampDate;
          } else if (timestamp.type === 1 && tagTimes[tagId].lastStart) {
            tagTimes[tagId].totalTime += (timestampDate - tagTimes[tagId].lastStart) / 1000 / 60 / 60;
            tagTimes[tagId].lastStart = null;
          }
        });
      });

    const summary = Object.keys(tagTimes).map((tagId) => {
      const totalTime = tagTimes[tagId].totalTime;
      const hours = Math.floor(totalTime);
      const minutes = Math.round((totalTime - hours) * 60);
      const tagName = tagsMap[tagId] || `Unknown Tag ${tagId}`;

      return {
        id: tagId,
        name: tagName,
        totalTime: `${hours}h ${minutes}m`,
      };
    });
    setTagSummary(summary);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const taskResponse = await fetch('http://localhost:3010/tasks');
        if (!taskResponse.ok) throw new Error('Failed to fetch tasks');
        const tasksList = await taskResponse.json();

        const tagsResponse = await fetch('http://localhost:3010/tags');
        if (!tagsResponse.ok) throw new Error('Failed to fetch tags');
        const tagsList = await tagsResponse.json();

        const timestampsResponse = await fetch('http://localhost:3010/timestamps');
        if (!timestampsResponse.ok) throw new Error('Failed to fetch timestamps');
        const timestamps = await timestampsResponse.json();

        const tagsMap = tagsList.reduce((acc, tag) => {
          acc[tag.id] = tag.name;
          return acc;
        }, {});

        setTasks(tasksList);
        setTags(tagsMap);

        calculateTaskSummary(timestamps, tasksList);
        calculateTagSummary(timestamps, tasksList, tagsMap);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message);
      }
    };

    fetchData();
  }, [startTime, endTime]);

  return (
    <div className="page-container">
      <header className="page-header">
        <h2>Summary of Time Spent</h2>
      </header>
      <main className="summary-main">
        <label>Start Time: </label>
        <input type="datetime-local" value={startTime} onChange={handleStartTimeChange} />
        <label>End Time: </label>
        <input type="datetime-local" value={endTime} onChange={handleEndTimeChange} />

        {error && <p className="error-message">{error}</p>}

        <h3>Task Summary</h3>
        <div className="summary-table">
          {taskSummary.map((task) => (
            <div key={task.id} className="summary-block">
              <div className="summary-row">
                <div className="summary-cell"><strong>Task:</strong> {task.name}</div>
                <div className="summary-cell"><strong>Total Time:</strong> {task.totalTime}</div>
              </div>
            </div>
          ))}
        </div>

        <h3>Tag Summary</h3>
        <div className="summary-table">
          {tagSummary.map((tag) => (
            <div key={tag.id} className="summary-block">
              <div className="summary-row">
                <div className="summary-cell"><strong>Tag:</strong> {tag.name}</div>
                <div className="summary-cell"><strong>Total Time:</strong> {tag.totalTime}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default TimeSummary;
