import React, { useEffect, useState } from 'react';
import './TaskList.css';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// TaskList component to display, manage, and filter tasks
const TaskList = () => {
  // State variables for task data, tags, filter tags, active tasks, and errors
  const [tasks, setTasks] = useState([]);
  const [tags, setTags] = useState({});
  const [filterTags, setFilterTags] = useState([]);
  const [activeTasks, setActiveTasks] = useState([]); // Track active tasks
  const [error, setError] = useState(null);

  // Ref to track if component is still mounted, helps in cleanup
  const isMounted = React.useRef(true);

  // Fetch tasks, tags, and active tasks from the backend API
  const fetchData = async () => {
    try {
      // Fetch tasks from server
      const taskResponse = await fetch('http://localhost:3010/tasks');
      if (!taskResponse.ok) throw new Error('Failed to fetch tasks');
      const taskData = await taskResponse.json();
      // Fetch tags from server
      const tagResponse = await fetch('http://localhost:3010/tags');
      if (!tagResponse.ok) throw new Error('Failed to fetch tags');
      const tagData = await tagResponse.json();
      // Fetch timestamps from server to determine active tasks
      const timestampResponse = await fetch('http://localhost:3010/timestamps');
      if (!timestampResponse.ok) throw new Error('Failed to fetch timestamps');
      const timestampData = await timestampResponse.json();

      if (isMounted.current) {
        // Retrieve and apply saved task order from localStorage
        const savedOrder = JSON.parse(localStorage.getItem('taskOrder'));
        const orderedTasks = savedOrder
          ? savedOrder.map(id => taskData.find(task => task.id === id)).filter(Boolean)
          : taskData;
        setTasks(orderedTasks);

        // Map tags to an object for easier access
        const tagsMap = {};
        tagData.forEach((tag) => {
          tagsMap[tag.id] = tag.name;
        });
        setTags(tagsMap);

        // Determine active tasks by filtering timestamps for tasks without a stop timestamp
        const activeTaskIds = timestampData
          .filter((timestamp) => timestamp.type === 0)
          .filter(
            (start) =>
              !timestampData.some(
                (stop) =>
                  stop.task === start.task &&
                  stop.type === 1 &&
                  new Date(stop.timestamp) > new Date(start.timestamp)
              )
          )
          .map((active) => active.task);

        setActiveTasks(activeTaskIds);
      }
    } catch (error) {
      if (isMounted.current) setError(error.message); // Set error if component is still mounted
    }
  };
  // Fetch data when the component mounts
  useEffect(() => {
    isMounted.current = true;
    fetchData();

    return () => {
      isMounted.current = false; // Cleanup on unmount
    };
  }, []); // Empty dependency array ensures this effect runs only once

  // Delete a task and update the UI state
  const handleDeleteTask = async taskId => {
    try {
      const response = await fetch(`http://localhost:3010/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      // Remove the task from local state after deletion
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      setActiveTasks(prevActiveTasks =>
        prevActiveTasks.filter(activeTaskId => activeTaskId !== taskId)
      );
    } catch (err) {
      setError(err.message);
    }
  };

  // Start a task by adding a start timestamp
  const handleStartTask = async taskId => {
    try {
      const response = await fetch('http://localhost:3010/timestamps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: taskId,
          timestamp: new Date().toISOString(),
          type: 0, // Start type
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start task');
      }
      // Add task ID to activeTasks list
      setActiveTasks(prevActiveTasks => [...prevActiveTasks, taskId]);
    } catch (err) {
      setError(err.message);
    }
  };

  // Stop a task by adding a stop timestamp
  const handleStopTask = async taskId => {
    try {
      const response = await fetch('http://localhost:3010/timestamps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: taskId,
          timestamp: new Date().toISOString(),
          type: 1, // Stop type
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to stop task');
      }
      // Remove task ID from activeTasks list
      setActiveTasks(prevActiveTasks =>
        prevActiveTasks.filter(activeTaskId => activeTaskId !== taskId)
      );
    } catch (err) {
      setError(err.message);
    }
  };

  // Toggle the selection of a filter tag
  const toggleFilterTag = tagId => {
    setFilterTags(prevFilterTags =>
      prevFilterTags.includes(tagId)
        ? prevFilterTags.filter(id => id !== tagId)
        : [...prevFilterTags, tagId]
    );
  };

  // Filter tasks based on selected tags
  const filteredTasks = filterTags.length > 0
    ? tasks.filter(task =>
        filterTags.every(tag => task.tags.split(',').includes(tag))
      )
    : tasks;

   // Reset all tag filters
  const resetFilters = () => {
    setFilterTags([]);
  };

  // Reorder tasks in the list through drag-and-drop
  const moveTask = (dragIndex, hoverIndex) => {
    const updatedTasks = [...tasks];
    const [draggedTask] = updatedTasks.splice(dragIndex, 1);
    updatedTasks.splice(hoverIndex, 0, draggedTask);
    setTasks(updatedTasks);

    // Save updated task order to localStorage
    localStorage.setItem('taskOrder', JSON.stringify(updatedTasks.map(task => task.id)));
  };
  // Component to represent an individual task item, with drag-and-drop capability
  const TaskItem = ({ task, index, moveTask }) => {
    const ref = React.useRef(null);
    const isActive = activeTasks.includes(task.id); // Check if task is active
    // Setup drop behavior for drag-and-drop
    const [, drop] = useDrop({
      accept: 'task',
      hover(item) {
        if (!ref.current) return;

        const dragIndex = item.index;
        const hoverIndex = index;

        if (dragIndex === hoverIndex) return;

        moveTask(dragIndex, hoverIndex);
        item.index = hoverIndex;
      },
    });
    // Setup drag behavior for drag-and-drop
    const [{ isDragging }, drag] = useDrag({
      type: 'task',
      item: { type: 'task', index },
      collect: monitor => ({
        isDragging: monitor.isDragging(),
      }),
    });
    // Combine drag and drop refs
    drag(drop(ref));

    return (
      <li
        ref={ref}
        className={`task-item ${isDragging ? 'dragging' : ''}`}
        tabIndex={0} // Makes the task keyboard navigable
        role="listitem"
      >
        <span className="task-name">{task.name}</span>
        <div className="task-tags">
          {/* Display tags for each task */}
          {task.tags.split(',').map(tagId => (
            <button
              key={tagId}
              className="tag-number"
              title={tags[tagId]}
              aria-label={`Tag ${tags[tagId]}`} // Improved accessibility with aria-label
            >
              {tagId}
            </button>
          ))}
        </div>
        <div className="button-group">
          {/* Start button for task */}
          <button
            className={`task-button ${isActive ? 'active' : ''}`}
            onClick={() => handleStartTask(task.id)}
            disabled={isActive}
            aria-label={isActive ? 'Task is running' : 'Start task'}
          >
            {isActive ? 'Running' : 'Start'}
          </button>
          {/* Stop button for task */}
          <button
            className="task-button"
            onClick={() => handleStopTask(task.id)}
            disabled={!isActive}
            aria-label="Stop task"
          >
            Stop
          </button>
          {/* Delete button for task */}
          <button
            className="task-button"
            onClick={() => handleDeleteTask(task.id)}
            aria-label="Delete task"
          >
            Delete
          </button>
        </div>
      </li>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="page-container">
        <header className="page-header">
          <h2>Your Tasks</h2>
        </header>
        <main className="task-main">
          {/* Display error message if any */}
          {error && <p className="error-message">{error}</p>}
          {/* Tag filter section */}
          <section className="filter-section">
            <h3>Filter by Tags</h3><p>Hover over tags for more info</p>
            <div className="filter-tags">
              {Object.keys(tags).map(tagId => (
                <button
                  key={tagId}
                  className={`tag-button ${
                    filterTags.includes(tagId) ? 'selected' : ''
                  }`}
                  onClick={() => toggleFilterTag(tagId)}
                  title={tags[tagId]}
                  aria-label={`Filter by tag ${tags[tagId]}`}
                >
                  {tagId}
                </button>
              ))}
            </div>
            <button className="task-button" onClick={resetFilters} aria-label="Reset filters">
              Reset Filters
            </button>
          </section>
          {/* Task list with drag-and-drop capability */}
          <div className="task-list-wrapper">
            <ul className="task-list" role="list">
              {filteredTasks.map((task, index) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  index={index}
                  moveTask={moveTask}
                />
              ))}
            </ul>
          </div>
        </main>
      </div>
    </DndProvider>
  );
};

export default TaskList;
