import React, { useEffect, useState } from 'react';
import './TaskList.css';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [tags, setTags] = useState({});
  const [filterTags, setFilterTags] = useState([]);
  const [activeTasks, setActiveTasks] = useState([]); // Track active tasks
  const [error, setError] = useState(null);

  // Track component mount status
  const isMounted = React.useRef(true);

  // Fetch tasks, tags, and active tasks from the backend
  const fetchData = async () => {
    try {
      const taskResponse = await fetch('http://localhost:3010/tasks');
      if (!taskResponse.ok) throw new Error('Failed to fetch tasks');
      const taskData = await taskResponse.json();

      const tagResponse = await fetch('http://localhost:3010/tags');
      if (!tagResponse.ok) throw new Error('Failed to fetch tags');
      const tagData = await tagResponse.json();

      const timestampResponse = await fetch('http://localhost:3010/timestamps');
      if (!timestampResponse.ok) throw new Error('Failed to fetch timestamps');
      const timestampData = await timestampResponse.json();

      if (isMounted.current) {
        const savedOrder = JSON.parse(localStorage.getItem('taskOrder'));
        const orderedTasks = savedOrder
          ? savedOrder.map(id => taskData.find(task => task.id === id)).filter(Boolean)
          : taskData;
        setTasks(orderedTasks);

        // Map tags into an object
        const tagsMap = {};
        tagData.forEach((tag) => {
          tagsMap[tag.id] = tag.name;
        });
        setTags(tagsMap);

        // Filter active tasks (tasks with type 0 without a type 1 after them)
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
      if (isMounted.current) setError(error.message);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchData(); // Fetch data when the component mounts

    return () => {
      isMounted.current = false; // Cleanup on unmount
    };
  }, []); // Empty dependency array ensures this effect runs only once

  // Handle task deletion
  const handleDeleteTask = async taskId => {
    try {
      const response = await fetch(`http://localhost:3010/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      // Update UI state locally after deletion
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      setActiveTasks(prevActiveTasks =>
        prevActiveTasks.filter(activeTaskId => activeTaskId !== taskId)
      );
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle task start
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

      setActiveTasks(prevActiveTasks => [...prevActiveTasks, taskId]);
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle task stop
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

      setActiveTasks(prevActiveTasks =>
        prevActiveTasks.filter(activeTaskId => activeTaskId !== taskId)
      );
    } catch (err) {
      setError(err.message);
    }
  };

  // Toggle tag filter selection
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

  // Reset tag filters
  const resetFilters = () => {
    setFilterTags([]);
  };

  // Task drag and drop handlers
  const moveTask = (dragIndex, hoverIndex) => {
    const updatedTasks = [...tasks];
    const [draggedTask] = updatedTasks.splice(dragIndex, 1);
    updatedTasks.splice(hoverIndex, 0, draggedTask);
    setTasks(updatedTasks);

    // Save the updated order to localStorage
    localStorage.setItem('taskOrder', JSON.stringify(updatedTasks.map(task => task.id)));
  };

  const TaskItem = ({ task, index, moveTask }) => {
    const ref = React.useRef(null);
    const isActive = activeTasks.includes(task.id); // Check if task is active

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

    const [{ isDragging }, drag] = useDrag({
      type: 'task',
      item: { type: 'task', index },
      collect: monitor => ({
        isDragging: monitor.isDragging(),
      }),
    });

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
          <button
            className={`task-button ${isActive ? 'active' : ''}`}
            onClick={() => handleStartTask(task.id)}
            disabled={isActive}
            aria-label={isActive ? 'Task is running' : 'Start task'}
          >
            {isActive ? 'Running' : 'Start'}
          </button>
          <button
            className="task-button"
            onClick={() => handleStopTask(task.id)}
            disabled={!isActive}
            aria-label="Stop task"
          >
            Stop
          </button>
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
          {error && <p className="error-message">{error}</p>}

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
