import React from 'react';
import './About.css'; // Optional: Add custom styles for the About page if needed

const About = () => {
  return (
    <div className="about-page page-container">
      <h2>About This Application</h2>
      <div className="about-content">
        <h3>Done by</h3>
        <p>Santeri Karppinen</p>

        <h3>Instructions for Use</h3>
        <p>
          This application is designed to track tasks and time spent on them. Using the intuitive UI, you can easily add, edit, and remove tasks.
          Simply navigate through the menu to explore different features. If anything seems unclear, please refer to the tooltips provided.
        </p>

        <h3>Content and Licenses</h3>
        <p>
          All content in this application has been created by me. No external assets or images have been used.
        </p>

        <h3>AI Tools Usage</h3>
        <p>AI tools were used in the troubleshooting of this application.</p>

        <h3>Working Hours</h3>
        <p>Estimated hours spent on this project: 25</p>

        <h3>Most Difficult Feature</h3>
        <p>The most difficult feature to implement was the dynamic task filtering based on tags.</p>
      </div>
    </div>
  );
};

export default About;

