import React, { useEffect, useState } from 'react';
import './TaskList.css';

const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [tags, setTags] = useState({});
  const [filterTags, setFilterTags] = useState([]);
  const [error, setError] = useState(null);

  // Fetch tasks and tags from the backend
  useEffect(() => {
    fetchTasks();
    fetchTags();
  }, []);

  const fetchTasks = () => {
    fetch('http://localhost:3010/tasks')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch tasks');
        }
        return response.json();
      })
      .then((data) => setTasks(data))
      .catch((error) => setError(error.message));
  };

  const fetchTags = () => {
    fetch('http://localhost:3010/tags')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch tags');
        }
        return response.json();
      })
      .then((data) => {
        const tagsMap = {};
        data.forEach((tag) => {
          tagsMap[tag.id] = tag.name;
        });
        setTags(tagsMap);
      })
      .catch((error) => setError(error.message));
  };

  // Handle task deletion
  const handleDeleteTask = async (taskId) => {
    try {
      const response = await fetch(`http://localhost:3010/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      fetchTasks(); // Refresh the task list
    } catch (err) {
      setError(err.message);
    }
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
    ? tasks.filter((task) => filterTags.every((tag) => task.tags.split(',').includes(tag)))
    : tasks;

  // Reset tag filters
  const resetFilters = () => {
    setFilterTags([]);
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h2>Your Tasks</h2>
      </header>
      <main className="task-main">
        {error && <p className="error-message">{error}</p>}

        {/* Tag Filter Section */}
        <section className="filter-section">
          <h3>Filter by Tags</h3>
          <div className="filter-tags">
            {Object.keys(tags).map((tagId) => (
              <button
                key={tagId}
                className={`tag-button ${filterTags.includes(tagId) ? 'selected' : ''}`}
                onClick={() => toggleFilterTag(tagId)}
                title={tags[tagId]}
              >
                {tagId}
              </button>
            ))}
          </div>
          <button className="task-button" onClick={resetFilters}>
            Reset Filters
          </button>
        </section>

        {/* Added margin to separate filter section and task list */}
        <div className="task-list-wrapper">
          <ul className="task-list">
            {filteredTasks.map((task) => (
              <li key={task.id} className="task-item">
                <span className="task-name">{task.name}</span>
                <div className="task-tags">
                  {task.tags.split(',').map((tagId) => (
                    <span
                      key={tagId}
                      className="tag-number"
                      title={tags[tagId]}
                    >
                      {tagId}
                    </span>
                  ))}
                </div>
                <div className="button-group">
                  <button className="task-button">Start</button>
                  <button className="task-button">Stop</button>
                  <button
                    className="task-button"
                    onClick={() => handleDeleteTask(task.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
};

export default TaskList;
