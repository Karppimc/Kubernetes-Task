import React from 'react';
import './TaskList.css';

const TaskList = () => {
  return (
    <div className="page-container">
      <header className="page-header">
        <h2>Your Tasks</h2>
      </header>
      <main className="task-main">
        <ul className="task-list">
          <li className="task-item">
            <span className="task-name">Project Work</span>
            <div className="button-group">
              <button className="task-button">Start</button>
              <button className="task-button">Stop</button>
              <button className="task-button">Delete</button>
            </div>
          </li>
          <li className="task-item">
            <span className="task-name">Exercise</span>
            <div className="button-group">
              <button className="task-button">Start</button>
              <button className="task-button">Stop</button>
              <button className="task-button">Delete</button>
            </div>
          </li>
          <li className="task-item">
            <span className="task-name">Read Book</span>
            <div className="button-group">
              <button className="task-button">Start</button>
              <button className="task-button">Stop</button>
              <button className="task-button">Delete</button>
            </div>
          </li>
        </ul>
      </main>
    </div>
  );
};

export default TaskList;
