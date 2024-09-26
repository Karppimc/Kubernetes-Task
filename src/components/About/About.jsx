import React from 'react';
import './About.css';

const About = () => {
  return (
    <div className="page-container">
      <header className="page-header">
        <h2>About This Project</h2>
      </header>
      <main className="about-main">
        <p>This project is a simple task tracker application built using React and Vite. It allows you to manage tasks, track time spent on each task, and view a summary of your activities.</p>
        <p>The application includes the following features:</p>
        <ul>
          <li>Create, edit, and delete tasks.</li>
          <li>Track time spent on various tasks.</li>
          <li>View a summary of your task activities.</li>
          <li>Responsive design with a clean, user-friendly interface.</li>
        </ul>
        <p>Created by [Santeri Karppinen].</p>
      </main>
    </div>
  );
};

export default About;
