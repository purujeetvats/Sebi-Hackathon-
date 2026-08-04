import React from 'react';
import { useAppContext } from '../../shared/context/AppContext';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Search, 
  TrendingUp, 
  BookOpen, 
  User, 
  Target, 
  MessageCircle, 
  Shield
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

export const Sidebar: React.FC = () => {
  const { getUserData } = useAppContext();
  const user = getUserData();

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { id: 'discover', label: 'Discover', icon: Search, path: '/discover' },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, path: '/analytics' },
    { id: 'learn', label: 'Learn', icon: BookOpen, path: '/learn' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
    { id: 'invest', label: 'Invest', icon: Target, path: '/invest' },
    { id: 'goals', label: 'Goals', icon: Target, path: '/goals' },
    { id: 'copilot', label: 'Copilot', icon: MessageCircle, path: '/copilot' },
    { id: 'trust', label: 'Trust', icon: Shield, path: '/trust' },
  ];

  const handleLogout = () => {
    // Clear session and redirect to login
    localStorage.removeItem('niveshos.session');
    localStorage.removeItem('niveshos.theme');
    // In a real app, you would navigate to login
    window.location.href = '/login';
  };

  return (
    <aside id="sidebar" className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          {/* Simplified logo - in real app, use SVG */}
          <div className="logo-placeholder">N</div>
        </div>
        <div className="brand-text">
          <span className="brand-name">NiveshOS</span>
          <span className="brand-tagline">Every asset. One brain.</span>
        </div>
      </div>

      <nav className="nav" aria-label="Main navigation">
        {navItems.map(item => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }: { isActive: boolean }) => 
              `nav-btn ${isActive ? 'active' : ''}`}
            end
          >
            <div className="nav-icon">
              <item.icon className="nav-icon" />
            </div>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button 
          id="notif-bell"
          className="notif-bell"
          type="button"
          aria-label="Open notifications"
          title="Notifications"
        >
          <svg className="icon-bell" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
            <path d="M18 8.4a6 6 0 0 0-12 0c0 6.4-2.4 8.2-2.4 8.2h16.8S18 14.8 18 8.4z"/>
            <path d="M13.7 20.4a2 2 0 0 1-3.4 0"/>
          </svg>
          <span className="notif-count" hidden>0</span>
        </button>
        
        <button 
          id="theme-toggle"
          className="theme-toggle"
          type="button"
          aria-label="Toggle color theme"
          title="Toggle theme"
        >
          {/* Sun/Moon icon would go here */}
        </button>

        <div id="investor-chip" className="investor-chip">
          <div className="avatar" id="investor-avatar" aria-hidden="true">
            {user ? user.avatar : 'PS'}
          </div>
          <div className="investor-info">
            <span className="investor-name" id="investor-name">
              {user ? user.name : 'Priya Sharma'}
            </span>
            <span className="investor-pan" id="investor-pan">
              {user ? user.pan : 'ABCPS****K'}
            </span>
          </div>
          <button 
            id="logout-btn"
            className="logout-btn"
            type="button"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <path d="M16 17l5-5-5-5"/>
              <path d="M21 12H9"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
};


