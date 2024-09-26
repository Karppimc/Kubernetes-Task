import React from 'react';
import './TimeSummary.css';

const TimeSummary = () => {
  return (
    <div className="page-container">
      <header className="page-header">
        <h2>Time Summary</h2>
      </header>
      <main className="summary-main">
        <h3>Summary of Time Spent</h3>
        <table className="summary-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Total Time</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Project Work</td>
              <td>5 hours</td>
            </tr>
            <tr>
              <td>Exercise</td>
              <td>2 hours</td>
            </tr>
            <tr>
              <td>Read Book</td>
              <td>3 hours</td>
            </tr>
          </tbody>
        </table>
      </main>
    </div>
  );
};

export default TimeSummary;
