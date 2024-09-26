import React from 'react';
import './TaskManagement.css';

const TaskManagement = () => {
  return (
    <div className="page-container">
      <header className="page-header">
        <h2>Task Management</h2>
      </header>
      <main className="management-main">
        <section className="management-form-section">
          <h3>Manage Your Tasks</h3>
          <form className="management-form">
            <label className="management-label">Task Name:</label>
            <input type="text" className="management-input" placeholder="Enter task name" />
            <button type="submit" className="management-button">Add Task</button>
          </form>
        </section>
        <section className="task-list-section">
          <h3>Existing Tasks</h3>
          <ul className="management-task-list">
            <li className="management-task-item">
              <span className="task-name">Project Work</span>
              <div className="button-group">
                <button className="management-button">Edit</button>
                <button className="management-button">Delete</button>
              </div>
            </li>
            <li className="management-task-item">
              <span className="task-name">Exercise</span>
              <div className="button-group">
                <button className="management-button">Edit</button>
                <button className="management-button">Delete</button>
              </div>
            </li>
            <li className="management-task-item">
              <span className="task-name">Read Book</span>
              <div className="button-group">
                <button className="management-button">Edit</button>
                <button className="management-button">Delete</button>
              </div>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
};

export default TaskManagement;
