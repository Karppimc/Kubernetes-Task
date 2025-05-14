import React, { useEffect, useState } from 'react';
import './TaskList.css';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [tags, setTags] = useState({});
  const [filterTags, setFilterTags] = useState([]);
  const [activeTasks, setActiveTasks] = useState([]);
  const [error, setError] = useState(null);
  const isMounted = React.useRef(true);

  const fetchData = async () => {
    try {
      const taskResponse = await fetch('/api/tasks');
      if (!taskResponse.ok) throw new Error('Failed to fetch tasks');
      const taskData = await taskResponse.json();

      const tagResponse = await fetch('/api/tags');
      if (!tagResponse.ok) throw new Error('Failed to fetch tags');
      const tagData = await tagResponse.json();

      const timestampResponse = await fetch('/api/timestamps');
      if (!timestampResponse.ok) throw new Error('Failed to fetch timestamps');
      const timestampData = await timestampResponse.json();

      if (isMounted.current) {
        const savedOrder = JSON.parse(localStorage.getItem('taskOrder'));
        const orderedTasks = savedOrder
          ? savedOrder.map(id => taskData.find(task => task.id === id)).filter(Boolean)
          : taskData;
        setTasks(orderedTasks);

        const tagsMap = {};
        tagData.forEach(tag => {
          tagsMap[tag.id] = tag.name;
        });
        setTags(tagsMap);

        const activeTaskIds = timestampData
          .filter(t => t.type === 0)
          .filter(start =>
            !timestampData.some(
              stop =>
                stop.task === start.task &&
                stop.type === 1 &&
                new Date(stop.timestamp) > new Date(start.timestamp)
            )
          )
          .map(active => active.task);

        setActiveTasks(activeTaskIds);
      }
    } catch (error) {
      if (isMounted.current) setError(error.message);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleDeleteTask = async taskId => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete task');

      setTasks(prev => prev.filter(task => task.id !== taskId));
      setActiveTasks(prev => prev.filter(id => id !== taskId));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStartTask = async taskId => {
    try {
      const response = await fetch('/api/timestamps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: taskId,
          timestamp: new Date().toISOString(),
          type: 0,
        }),
      });

      if (!response.ok) throw new Error('Failed to start task');
      setActiveTasks(prev => [...prev, taskId]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStopTask = async taskId => {
    try {
      const response = await fetch('/api/timestamps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: taskId,
          timestamp: new Date().toISOString(),
          type: 1,
        }),
      });

      if (!response.ok) throw new Error('Failed to stop task');
      setActiveTasks(prev => prev.filter(id => id !== taskId));
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleFilterTag = tagId => {
    setFilterTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const filteredTasks =
    filterTags.length > 0
      ? tasks.filter(task =>
          filterTags.every(tag => task.tags.split(',').includes(tag))
        )
      : tasks;

  const resetFilters = () => setFilterTags([]);

  const moveTask = (dragIndex, hoverIndex) => {
    const updatedTasks = [...tasks];
    const [draggedTask] = updatedTasks.splice(dragIndex, 1);
    updatedTasks.splice(hoverIndex, 0, draggedTask);
    setTasks(updatedTasks);
    localStorage.setItem('taskOrder', JSON.stringify(updatedTasks.map(t => t.id)));
  };

  const TaskItem = ({ task, index, moveTask }) => {
    const ref = React.useRef(null);
    const isActive = activeTasks.includes(task.id);

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
      collect: monitor => ({ isDragging: monitor.isDragging() }),
    });

    drag(drop(ref));

    return (
      <li
        ref={ref}
        className={`task-item ${isDragging ? 'dragging' : ''}`}
        tabIndex={0}
        role="listitem"
      >
        <span className="task-name">{task.name}</span>
        <div className="task-tags">
          {task.tags.split(',').map(tagId => (
            <button
              key={tagId}
              className="tag-number"
              title={tags[tagId]}
              aria-label={`Tag ${tags[tagId]}`}
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
                  className={`tag-button ${filterTags.includes(tagId) ? 'selected' : ''}`}
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
