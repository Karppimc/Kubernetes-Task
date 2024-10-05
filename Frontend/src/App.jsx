import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import TaskList from './components/TaskList/TaskList';
import TimeSummary from './components/TimeSummary/TimeSummary';
import TaskManagement from './components/TaskManagement/TaskManagement';
import About from './components/About/About'; // Import the About component
import './App.css';

const App = () => {
  return (
    <Router>
      <div className="app-container">
        <header className="banner">
          <h1 className="banner-title">Task Tracker</h1>
          <nav className="nav-menu">
            <Link to="/" className="nav-link">Task List</Link>
            <Link to="/management" className="nav-link">Task Management</Link>
            <Link to="/summary" className="nav-link">Time Summary</Link>
            <Link to="/about" className="nav-link">About</Link>
          </nav>
        </header>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<TaskList />} />
            <Route path="/management" element={<TaskManagement />} />
            <Route path="/summary" element={<TimeSummary />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;

