import React, { useState, useEffect } from 'react';
import './TaskManagement.css';

const TaskManagement = () => {
  // State variables to manage tasks, task inputs, tags, error messages, and filters
  const [tasks, setTasks] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskTags, setNewTaskTags] = useState([]); // Updated to store selected tags
  const [newTagName, setNewTagName] = useState('');
  const [editTaskId, setEditTaskId] = useState(null);
  const [editTaskName, setEditTaskName] = useState('');
  const [allTags, setAllTags] = useState([]);
  const [error, setError] = useState(null);
  const [editTagsTaskId, setEditTagsTaskId] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [filterTags, setFilterTags] = useState([]); // State to manage filtering

  useEffect(() => {
    let isMounted = true; // Flag to check if the component is mounted
    // Fetch tasks and tags from backend
    const fetchTasksAndTags = async () => {
      if (isMounted) {
        await fetchTasks();
        await fetchTags();
      }
    };

    fetchTasksAndTags();

    return () => {
      isMounted = false; // Clean up when the component is unmounted
    };
  }, []);

  // Fetch all tasks from the backend
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
      setAllTags(data); // Store all available tags
    } catch (err) {
      setError(err.message);
    }
  };

  // Add a new task to the task list
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskName) {
      alert('Task name is required');
      return;
    }

    if (newTaskTags.length === 0) {
      alert('At least one tag must be selected');
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
          tags: newTaskTags.join(','), // Use the selected tags
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add task');
      }

      fetchTasks(); // Refresh task list after adding a new task
      setNewTaskName(''); // Reset task name input
      setNewTaskTags([]); // Clear selected tags after submission
    } catch (err) {
      setError(err.message);
    }
  };

   // Add a new tag to the tags list
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

      fetchTags();  // Refresh tag list after adding
      setNewTagName('');
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete a task from the task list
  const handleDeleteTask = async (taskId) => {
    try {
      const response = await fetch(`http://localhost:3010/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      fetchTasks(); // Refresh tasks list after deletion
    } catch (err) {
      setError(err.message);
    }
  };

  // Update task name and tags for a specific task
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

   // Toggle selection of tags when adding or editing a task
  const toggleTagSelection = (tagId, isAddingNewTask = false) => {
    if (isAddingNewTask) {
      setNewTaskTags((prevSelectedTags) =>
        prevSelectedTags.includes(tagId)
          ? prevSelectedTags.filter((id) => id !== tagId)
          : [...prevSelectedTags, tagId]
      );
    } else {
      setSelectedTags((prevSelectedTags) =>
        prevSelectedTags.includes(tagId)
          ? prevSelectedTags.filter((id) => id !== tagId)
          : [...prevSelectedTags, tagId]
      );
    }
  };

  // Enable tag editing mode for a specific task
  const handleEditTags = (task) => {
    setEditTagsTaskId(task.id);
    setEditTaskName(task.name);
    setSelectedTags(task.tags.split(',').map((tag) => tag.trim()));
  };

  // Toggle tag selection for filtering tasks
  const toggleFilterTag = (tagId) => {
    setFilterTags((prevFilterTags) =>
      prevFilterTags.includes(tagId)
        ? prevFilterTags.filter((id) => id !== tagId)
        : [...prevFilterTags, tagId]
    );
  };

   // Filter tasks based on selected tags
  const filteredTasks = filterTags.length > 0
    ? tasks.filter((task) => filterTags.every((tag) => task.tags.split(',').includes(tag)))
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
          <h3>Filter by Tags</h3><p>Hover over tags for more info</p>
          <div className="filter-tags">
            {allTags.map((tag) => (
              <button
                key={tag.id}
                className={`tag-button ${filterTags.includes(tag.id.toString()) ? 'selected' : ''}`}
                onClick={() => toggleFilterTag(tag.id.toString())}
                title={`${tag.id}. ${tag.name}`}
                aria-label={`Filter by tag ${tag.name}`}
              >
                {tag.id}
              </button>
            ))}
          </div>
          <button className="management-button" onClick={resetFilters} aria-label="Reset Filters">
            Reset Filters
          </button>
        </section>

        {/* Form to add new tasks */}
        <section className="management-form-section">
          <h3>Manage Your Tasks</h3>
          <form className="management-form" onSubmit={handleAddTask}>
            <label className="management-label" htmlFor="task-name">Task Name:</label>
            <input
              type="text"
              id="task-name"
              className="management-input"
              placeholder="Enter task name"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              aria-label="Task Name"
            />
            <label className="management-label">Select Tags:</label>

            <div className="tags-container">
              {allTags.map((tag) => (
                <label key={tag.id}>
                  <input
                    type="checkbox"
                    checked={newTaskTags.includes(tag.id.toString())}
                    onChange={() => toggleTagSelection(tag.id.toString(), true)}
                    aria-label={`Select tag ${tag.name}`}
                  />
                  {tag.name}
                </label>
              ))}
            </div>

            <button type="submit" className="management-button add-task-button" aria-label="Add Task">
              Add Task
            </button>
          </form>

          <form className="management-form" onSubmit={(e) => e.preventDefault()}>
            <label className="management-label" htmlFor="new-tag">New Tag:</label>
            <input
              type="text"
              id="new-tag"
              className="management-input"
              placeholder="Enter new tag"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              aria-label="New Tag"
            />
            <button
              type="button"
              className="management-button"
              onClick={handleAddTag}
              aria-label="Add Tag"
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
              <li key={task.id} className="management-task-item" tabIndex={0} role="listitem">
                {editTagsTaskId === task.id ? (
                  <>
                    <input
                      type="text"
                      value={editTaskName}
                      onChange={(e) => setEditTaskName(e.target.value)}
                      className="edit-input"
                      aria-label="Edit Task Name"
                    />
                    <div className="task-tags">
                      {allTags.map((tag) => (
                        <button
                          key={tag.id}
                          className={`tag-button ${selectedTags.includes(tag.id.toString()) ? 'selected' : ''}`}
                          onClick={() => toggleTagSelection(tag.id.toString())}
                          title={`${tag.id}. ${tag.name}`}
                          aria-label={`Toggle tag ${tag.name}`}
                        >
                          {tag.id}
                        </button>
                      ))}
                    </div>
                    <button
                      className="management-button"
                      onClick={() => handleUpdateTask(task.id)}
                      aria-label="Save Changes"
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <span className="task-name">{task.name}</span>
                    <div className="task-tags">
                      {task.tags.split(',').map((tagId) => {
                        const tagName = allTags.find((tag) => tag.id === parseInt(tagId))?.name || tagId;
                        return (
                          <button key={tagId} className="tag-number" title={tagName} aria-label={`Tag ${tagName}`}>
                            {tagId}
                          </button>
                        );
                      })}
                    </div>
                    <div className="button-group">
                      <button className="management-button" onClick={() => handleEditTags(task)} aria-label="Edit Task">
                        Edit Task
                      </button>
                      <button className="management-button" onClick={() => handleDeleteTask(task.id)} aria-label="Delete Task">
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
