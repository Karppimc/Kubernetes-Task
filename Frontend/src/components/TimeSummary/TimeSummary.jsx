import React, { useEffect, useState } from 'react';
import './TimeSummary.css';

const TimeSummary = () => {
  // State variables to manage tasks, tags, time inputs, summaries, and errors
  const [tasks, setTasks] = useState([]);
  const [tags, setTags] = useState({});
  const [startTime, setStartTime] = useState('2024-10-01T12:00');
  const [endTime, setEndTime] = useState(getLocalTime());
  const [taskSummary, setTaskSummary] = useState([]);
  const [tagSummary, setTagSummary] = useState([]);
  const [error, setError] = useState(null);

  // Function to get the current local time formatted as a datetime-local string
  function getLocalTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }
  // Update start time based on user input
  const handleStartTimeChange = (event) => {
    setStartTime(event.target.value);
  };
  // Update end time based on user input
  const handleEndTimeChange = (event) => {
    setEndTime(event.target.value);
  };
  // Calculate the total time spent on each task based on timestamps
  const calculateTaskSummary = (timestamps, tasksList) => {
    const taskTimes = {};
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    // Sort timestamps and accumulate time spent on each task
    timestamps
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .forEach((timestamp) => {
        const timestampDate = new Date(timestamp.timestamp);
        if (timestampDate < startDate || timestampDate > endDate) return;

        const taskId = timestamp.task;
        if (!taskTimes[taskId]) {
          taskTimes[taskId] = { totalTime: 0, lastStart: null };
        }
        // Start time for the task
        if (timestamp.type === 0) {
          taskTimes[taskId].lastStart = timestampDate;
          // Stop time, calculate duration and reset start
        } else if (timestamp.type === 1 && taskTimes[taskId].lastStart) {
          taskTimes[taskId].totalTime += (timestampDate - taskTimes[taskId].lastStart) / 1000 / 60 / 60;
          taskTimes[taskId].lastStart = null;
        }
      });
      // Create a summary with task names and total times in hours and minutes
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
  // Calculate the total time spent per tag based on timestamps
  const calculateTagSummary = (timestamps, tasksList, tagsMap) => {
    const tagTimes = {};
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    // Sort timestamps and accumulate time spent on each tag
    timestamps
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .forEach((timestamp) => {
        const timestampDate = new Date(timestamp.timestamp);
        if (timestampDate < startDate || timestampDate > endDate) return;

        const task = tasksList.find((t) => t.id === timestamp.task);
        if (!task || !task.tags) return;
        // Process each tag associated with the task
        task.tags.split(',').forEach((tagId) => {
          tagId = tagId.trim();
          if (!tagTimes[tagId]) {
            tagTimes[tagId] = { totalTime: 0, lastStart: null };
          }
          // Start time for the tag
          if (timestamp.type === 0) {
            tagTimes[tagId].lastStart = timestampDate;
            // Stop time, calculate duration and reset start
          } else if (timestamp.type === 1 && tagTimes[tagId].lastStart) {
            tagTimes[tagId].totalTime += (timestampDate - tagTimes[tagId].lastStart) / 1000 / 60 / 60;
            tagTimes[tagId].lastStart = null;
          }
        });
      });
      // Create a summary with tag names and total times in hours and minutes
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
  // Fetch data from the backend when the component mounts or when time range changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tasks from backend
        const taskResponse = await fetch('http://localhost:3010/tasks');
        if (!taskResponse.ok) throw new Error('Failed to fetch tasks');
        const tasksList = await taskResponse.json();
        // Fetch tags from backend
        const tagsResponse = await fetch('http://localhost:3010/tags');
        if (!tagsResponse.ok) throw new Error('Failed to fetch tags');
        const tagsList = await tagsResponse.json();
        // Fetch timestamps from backend
        const timestampsResponse = await fetch('http://localhost:3010/timestamps');
        if (!timestampsResponse.ok) throw new Error('Failed to fetch timestamps');
        const timestamps = await timestampsResponse.json();
        // Convert tags list to a map for easier access
        const tagsMap = tagsList.reduce((acc, tag) => {
          acc[tag.id] = tag.name;
          return acc;
        }, {});

        setTasks(tasksList);
        setTags(tagsMap);
        // Calculate and set summaries
        calculateTaskSummary(timestamps, tasksList);
        calculateTagSummary(timestamps, tasksList, tagsMap);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message);
      }
    };

    fetchData();
  }, [startTime, endTime]); // Run effect on start or end time change

  return (
    <div className="page-container">
      <header className="page-header">
        <h2>Summary of Time Spent</h2>
      </header>
      <main className="summary-main">
        <label htmlFor="start-time">Start Time: </label>
        <input
          id="start-time"
          type="datetime-local"
          value={startTime}
          onChange={handleStartTimeChange}
          aria-label="Select start time"
        />
        <label htmlFor="end-time">End Time: </label>
        <input
          id="end-time"
          type="datetime-local"
          value={endTime}
          onChange={handleEndTimeChange}
          aria-label="Select end time"
        />

        {error && <p className="error-message">{error}</p>}

        <h3>Task Summary</h3>
        <div className="summary-table" tabIndex={0} role="table" aria-label="Task summary">
          {taskSummary.map((task) => (
            <div key={task.id} className="summary-block" role="row">
              <div className="summary-row" role="grid">
                <div className="summary-cell" role="gridcell"><strong>Task:</strong> {task.name}</div>
                <div className="summary-cell" role="gridcell"><strong>Total Time:</strong> {task.totalTime}</div>
              </div>
            </div>
          ))}
        </div>

        <h3>Tag Summary</h3>
        <div className="summary-table" tabIndex={0} role="table" aria-label="Tag summary">
          {tagSummary.map((tag) => (
            <div key={tag.id} className="summary-block" role="row">
              <div className="summary-row" role="grid">
                <div className="summary-cell" role="gridcell"><strong>Tag:</strong> {tag.name}</div>
                <div className="summary-cell" role="gridcell"><strong>Total Time:</strong> {tag.totalTime}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default TimeSummary;
