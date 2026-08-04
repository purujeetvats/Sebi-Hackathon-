import React from 'react';
import { Search, Bell, UserCircle } from 'lucide-react';

export const Header: React.FC = () => {

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle search functionality
  };

  const handleNotifications = () => {
    // Handle notifications
  };

  const handleProfile = () => {
    // Handle profile dropdown
  };

  return (
    <header className="header">
      <div className="header-content">
        <form onSubmit={handleSearch} className="search-bar">
          <input
            type="text"
            placeholder="Search... "
            aria-label="Search"
          />
          <button type="submit" className="search-button">
            <Search />
          </button>
        </form>
        
        <div className="header-actions">
          <button 
            className="icon-button" 
            onClick={handleNotifications}
            aria-label="Notifications"
          >
            <Bell />
            <span className="notification-badge">0</span>
          </button>
          
          <button 
            className="icon-button" 
            onClick={handleProfile}
            aria-label="Profile"
          >
            <UserCircle />
          </button>
        </div>
      </div>
    </header>
  );
};


