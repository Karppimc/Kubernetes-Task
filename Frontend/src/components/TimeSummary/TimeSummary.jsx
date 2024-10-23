import React, { useEffect, useState } from 'react';
import './TimeSummary.css';

const TimeSummary = () => {
  const [tasks, setTasks] = useState([]);
  const [tags, setTags] = useState({});
  const [startTime, setStartTime] = useState('2024-10-01T12:00'); // Default start time
  const [endTime, setEndTime] = useState(getLocalTime()); // Default to current time in local timezone
  const [error, setError] = useState(null);
  const [taskSummary, setTaskSummary] = useState([]);
  const [tagSummary, setTagSummary] = useState([]);

  // Helper function to get the current time in local timezone in the format for datetime-local
  function getLocalTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Adjust to local time
    return now.toISOString().slice(0, 16); // Return YYYY-MM-DDTHH:MM
  }

  // Function to handle start time change
  const handleStartTimeChange = (event) => {
    setStartTime(event.target.value);
  };

  // Function to handle end time change
  const handleEndTimeChange = (event) => {
    setEndTime(event.target.value);
  };

  // Function to calculate total time spent on tasks, applying time range filter
  const calculateTimeSummary = (timestamps, tasksList) => {
    const taskTimes = {};

    // Convert startTime and endTime to Date objects for filtering
    const startTimeDate = new Date(startTime);
    const endTimeDate = new Date(endTime);

    // Sort timestamps by date to ensure proper pairing
    const sortedTimestamps = [...timestamps].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    sortedTimestamps.forEach((timestamp) => {
      const timestampDate = new Date(timestamp.timestamp);

      // Only consider timestamps within the specified time range
      if (timestampDate < startTimeDate || timestampDate > endTimeDate) {
        return; // Skip timestamps outside the range
      }

      const taskId = timestamp.task;

      // Initialize time tracking for this task if not already initialized
      if (!taskTimes[taskId]) {
        taskTimes[taskId] = { totalTime: 0, lastStart: null };
      }

      if (timestamp.type === 0) { // Start time
        taskTimes[taskId].lastStart = timestampDate;
      } else if (timestamp.type === 1 && taskTimes[taskId].lastStart) { // Stop time
        const timeSpent = (timestampDate - taskTimes[taskId].lastStart) / 1000 / 60 / 60; // Time in hours
        if (timeSpent > 0) {
          taskTimes[taskId].totalTime += timeSpent;
        }
        taskTimes[taskId].lastStart = null; // Reset lastStart after stop
      }
    });

    // Handle ongoing tasks with no stop timestamps
    Object.keys(taskTimes).forEach((taskId) => {
      if (taskTimes[taskId].lastStart) {
        const now = new Date();
        const ongoingTime = (now - taskTimes[taskId].lastStart) / 1000 / 60 / 60; // Time until now in hours
        taskTimes[taskId].totalTime += ongoingTime;
      }
    });

    // Create task summary with names and formatted time
    const summary = Object.keys(taskTimes).map((taskId) => {
      const totalTime = taskTimes[taskId].totalTime;
      const hours = Math.floor(totalTime);
      const minutes = Math.round((totalTime - hours) * 60);

      // Find the task name from the tasksList
      const task = tasksList.find((t) => t.id === Number(taskId));

      return {
        id: taskId,
        name: task ? task.name : `Task ${taskId}`, // Use task name if available
        totalTime: `${hours}h ${minutes}m`, // Format total time as hours and minutes
      };
    });

    console.log('Task Summary:', summary);
    setTaskSummary(summary); // Update the tasks state with the task summary
  };

  // Function to calculate total time spent on tags
  const calculateTagSummary = (timestamps, tasksList) => {
    const tagTimes = {};

    // Convert startTime and endTime to Date objects for filtering
    const startTimeDate = new Date(startTime);
    const endTimeDate = new Date(endTime);

    // Sort timestamps by date to ensure proper pairing
    const sortedTimestamps = [...timestamps].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    sortedTimestamps.forEach((timestamp) => {
      const timestampDate = new Date(timestamp.timestamp);

      // Only consider timestamps within the specified time range
      if (timestampDate < startTimeDate || timestampDate > endTimeDate) {
        return; // Skip timestamps outside the range
      }

      const taskId = timestamp.task;
      const task = tasksList.find((t) => t.id === Number(taskId));

      if (task) {
        const tags = task.tags.split(',');

        tags.forEach((tag) => {
          if (!tagTimes[tag]) {
            tagTimes[tag] = { totalTime: 0, lastStart: null };
          }

          if (timestamp.type === 0) { // Start time
            tagTimes[tag].lastStart = timestampDate;
          } else if (timestamp.type === 1 && tagTimes[tag].lastStart) { // Stop time
            const timeSpent = (timestampDate - tagTimes[tag].lastStart) / 1000 / 60 / 60; // Time in hours
            if (timeSpent > 0) {
              tagTimes[tag].totalTime += timeSpent;
            }
            tagTimes[tag].lastStart = null; // Reset lastStart after stop
          }
        });
      }
    });

    // Handle ongoing tasks with no stop timestamps
    Object.keys(tagTimes).forEach((tag) => {
      if (tagTimes[tag].lastStart) {
        const now = new Date();
        const ongoingTime = (now - tagTimes[tag].lastStart) / 1000 / 60 / 60; // Time until now in hours
        tagTimes[tag].totalTime += ongoingTime;
      }
    });

    // Create tag summary with formatted time and include tag names
    const summary = Object.keys(tagTimes).map((tagId) => {
      const totalTime = tagTimes[tagId].totalTime;
      const hours = Math.floor(totalTime);
      const minutes = Math.round((totalTime - hours) * 60);

      const tagName = tags[tagId]; // Get tag name from the mapped tags

      return {
        id: tagId,
        name: tagName ? tagName : `Unknown Tag ${tagId}`, // Use tag name or default to "Unknown Tag {id}"
        totalTime: `${hours}h ${minutes}m`, // Format total time as hours and minutes
      };
    });

    console.log('Tag Summary:', summary);
    setTagSummary(summary); // Update the tags state with the tag summary
  };

  // Fetch tasks, tags, and timestamps
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tasks
        const taskResponse = await fetch('http://localhost:3010/tasks');
        if (!taskResponse.ok) {
          throw new Error('Failed to fetch tasks');
        }
        const tasksList = await taskResponse.json();

        // Fetch tags
        const tagResponse = await fetch('http://localhost:3010/tags');
        if (!tagResponse.ok) {
          throw new Error('Failed to fetch tags');
        }
        const tagsList = await tagResponse.json();
        const tagsMap = {};
        tagsList.forEach((tag) => {
          tagsMap[tag.id] = tag.name; // Store tag name by tag ID
        });
        setTags(tagsMap); // Save tags

        // Fetch timestamps
        const timestampResponse = await fetch('http://localhost:3010/timestamps');
        if (!timestampResponse.ok) {
          throw new Error('Failed to fetch timestamps');
        }
        const timestamps = await timestampResponse.json();

        console.log('Fetched tasks:', tasksList);
        console.log('Fetched timestamps:', timestamps);

        // Calculate time summaries for tasks and tags
        calculateTimeSummary(timestamps, tasksList);
        calculateTagSummary(timestamps, tasksList);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message);
      }
    };

    fetchData();
  }, [startTime, endTime]); // Re-run when startTime or endTime changes

  return (
    <div className="page-container">
      <header className="page-header">
        <h2>Time Summary</h2>
      </header>
      <main className="summary-main">
        <h3>Summary of Time Spent</h3>
        <label>Start Time: </label>
        <input type="datetime-local" value={startTime} onChange={handleStartTimeChange} />
        <label>End Time: </label>
        <input type="datetime-local" value={endTime} onChange={handleEndTimeChange} />

        {error && <p className="error-message">{error}</p>}

        {/* Task Summary Table */}
        <table className="summary-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Total Time (hours and minutes)</th>
            </tr>
          </thead>
          <tbody>
            {taskSummary.map((task) => (
              <tr key={task.id}>
                <td>{task.name}</td>{/* Display task name */}
                <td>{task.totalTime}</td>{/* Display formatted time */}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tag Summary Table */}
        <table className="summary-table">
          <thead>
            <tr>
              <th>Tag</th>
              <th>Total Time (hours and minutes)</th>
            </tr>
          </thead>
          <tbody>
            {tagSummary.map((tag) => (
              <tr key={tag.id}>
                <td>{`${tag.id}: ${tag.name}`}</td>{/* Display tag number and name */}
                <td>{tag.totalTime}</td>{/* Display formatted time */}
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
};

export default TimeSummary;
