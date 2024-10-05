import React, { useState, useEffect } from 'react';
import './TaskManagement.css';

const TaskManagement = () => {
  const [tasks, setTasks] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskTags, setNewTaskTags] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [editTaskId, setEditTaskId] = useState(null);
  const [editTaskName, setEditTaskName] = useState('');
  const [allTags, setAllTags] = useState([]);
  const [error, setError] = useState(null);
  const [editTagsTaskId, setEditTagsTaskId] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [filterTags, setFilterTags] = useState([]); // State to manage filtering

  useEffect(() => {
    fetchTasks();
    fetchTags();
  }, []);

  // Fetch tasks from the backend
  const fetchTasks = async () => {
    try {
      const response = await fetch('http://localhost:3010/tasks');
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      const data = await response.json();
      setTasks(data);
    } catch (err) {
      setError(err.message);
    }
  };

  // Fetch all tags from the backend
  const fetchTags = async () => {
    try {
      const response = await fetch('http://localhost:3010/tags');
      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }
      const data = await response.json();
      setAllTags(data);
    } catch (err) {
      setError(err.message);
    }
  };

  // Add a new task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskName) {
      alert('Task name is required');
      return;
    }

    try {
      const response = await fetch('http://localhost:3010/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTaskName,
          tags: newTaskTags,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add task');
      }

      fetchTasks();
      setNewTaskName('');
      setNewTaskTags('');
    } catch (err) {
      setError(err.message);
    }
  };

  // Add a new tag
  const handleAddTag = async () => {
    if (!newTagName) {
      alert('Tag name is required');
      return;
    }

    try {
      const response = await fetch('http://localhost:3010/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTagName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add tag');
      }

      fetchTags();
      setNewTagName('');
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete a task
  const handleDeleteTask = async (taskId) => {
    try {
      const response = await fetch(`http://localhost:3010/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      fetchTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  // Update tags and task name for a specific task
  const handleUpdateTask = async (taskId) => {
    try {
      const response = await fetch(`http://localhost:3010/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: editTaskName, tags: selectedTags.join(',') }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      setEditTagsTaskId(null);
      fetchTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  // Toggle tag selection for a task
  const toggleTagSelection = (tagId) => {
    setSelectedTags((prevSelectedTags) =>
      prevSelectedTags.includes(tagId)
        ? prevSelectedTags.filter((id) => id !== tagId)
        : [...prevSelectedTags, tagId]
    );
  };

  // Handle tag editing mode
  const handleEditTags = (task) => {
    setEditTagsTaskId(task.id);
    setEditTaskName(task.name);
    setSelectedTags(task.tags.split(',').map((tag) => tag.trim()));
  };

  // Toggle tag filter selection
  const toggleFilterTag = (tagId) => {
    setFilterTags((prevFilterTags) =>
      prevFilterTags.includes(tagId)
        ? prevFilterTags.filter((id) => id !== tagId)
        : [...prevFilterTags, tagId]
    );
  };

  // Filter tasks based on selected tags
  const filteredTasks = filterTags.length > 0
    ? tasks.filter(task => filterTags.every(tag => task.tags.split(',').includes(tag)))
    : tasks;

  // Reset tag filters
  const resetFilters = () => {
    setFilterTags([]);
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h2>Task Management</h2>
      </header>
      <main className="management-main">
        {error && <p className="error-message">{error}</p>}

        {/* Tag Filter Section */}
        <section className="filter-section">
          <h3>Filter by Tags</h3>
          <div className="filter-tags">
            {allTags.map((tag) => (
              <button
                key={tag.id}
                className={`tag-button ${filterTags.includes(tag.id.toString()) ? 'selected' : ''}`}
                onClick={() => toggleFilterTag(tag.id.toString())}
                title={`${tag.id}. ${tag.name}`}
              >
                {tag.id}
              </button>
            ))}
          </div>
          <button className="management-button" onClick={resetFilters}>
            Reset Filters
          </button>
        </section>

        {/* Form to add new tasks */}
        <section className="management-form-section">
          <h3>Manage Your Tasks</h3>
          <form className="management-form" onSubmit={handleAddTask}>
            <label className="management-label">Task Name:</label>
            <input
              type="text"
              className="management-input"
              placeholder="Enter task name"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
            />
            <label className="management-label">Tags (comma-separated):</label>
            <input
              type="text"
              className="management-input"
              placeholder="Enter tags"
              value={newTaskTags}
              onChange={(e) => setNewTaskTags(e.target.value)}
            />
            <button type="submit" className="management-button">Add Task</button>
          </form>

          {/* Form to add new tags */}
          <form className="management-form" onSubmit={(e) => e.preventDefault()}>
            <label className="management-label">New Tag:</label>
            <input
              type="text"
              className="management-input"
              placeholder="Enter new tag"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
            />
            <button
              type="button"
              className="management-button"
              onClick={handleAddTag}
            >
              Add Tag
            </button>
          </form>
        </section>

        {/* Display existing tasks */}
        <section className="task-list-section">
          <h3>Existing Tasks</h3>
          <ul className="management-task-list">
            {filteredTasks.map((task) => (
              <li key={task.id} className="management-task-item">
                {editTagsTaskId === task.id ? (
                  <>
                    <input
                      type="text"
                      value={editTaskName}
                      onChange={(e) => setEditTaskName(e.target.value)}
                      className="edit-input"
                    />
                    <div className="task-tags">
                      {allTags.map((tag) => (
                        <button
                          key={tag.id}
                          className={`tag-button ${selectedTags.includes(tag.id.toString()) ? 'selected' : ''}`}
                          onClick={() => toggleTagSelection(tag.id.toString())}
                          title={`${tag.id}. ${tag.name}`}
                        >
                          {tag.id}
                        </button>
                      ))}
                    </div>
                    <button
                      className="management-button"
                      onClick={() => handleUpdateTask(task.id)}
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <span className="task-name">{task.name}</span>
                    <div className="task-tags">
                      {task.tags.split(',').map((tagId) => {
                        const tagName = allTags.find(tag => tag.id === parseInt(tagId))?.name || tagId;
                        return (
                          <button
                            key={tagId}
                            className="tag-number"
                            title={tagName}
                          >
                            {tagId}
                          </button>
                        );
                      })}
                    </div>
                    <div className="button-group">
                      <button
                        className="management-button"
                        onClick={() => handleEditTags(task)}
                      >
                        Edit Task
                      </button>
                      <button
                        className="management-button"
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default TaskManagement;
