import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './shared/context/AppContext';
import { Sidebar } from './features/layout/Sidebar';
import { Header } from './features/layout/Header';
import { Dashboard } from './features/dashboard/Dashboard';
import { Discover } from './features/discover/Discover';
import { Analytics } from './features/analytics/Analytics';
import { Learn } from './features/learn/Learn';
import { Profile } from './features/profile/Profile';
import { Invest } from './features/invest/Invest';
import { Goals } from './features/goals/Goals';
import { Copilot } from './features/copilot/Copilot';
import { Trust } from './features/trust/Trust';
import { NotFound } from './features/layout/NotFound';
import { Onboarding } from './features/onboarding/Onboarding';
import { Login } from './features/auth/Login';
import './App.css';

const App: React.FC = () => {
  return (
    <AppProvider>
      <Router>
        <div className="app">
          <Sidebar />
          <div className="main-content">
            <Header />
            <div className="content">
              <Routes>
                {/* Protected routes - require authentication */}
                <Route 
                  element={requireAuth(<Dashboard />)} 
                  path="/dashboard" 
                />
                <Route 
                  element={requireAuth(<Discover />)} 
                  path="/discover" 
                />
                <Route 
                  element={requireAuth(<Analytics />)} 
                  path="/analytics" 
                />
                <Route 
                  element={requireAuth(<Learn />)} 
                  path="/learn" 
                />
                <Route 
                  element={requireAuth(<Profile />)} 
                  path="/profile" 
                />
                <Route 
                  element={requireAuth(<Invest />)} 
                  path="/invest" 
                />
                <Route 
                  element={requireAuth(<Goals />)} 
                  path="/goals" 
                />
                <Route 
                  element={requireAuth(<Copilot />)} 
                  path="/copilot" 
                />
                <Route 
                  element={requireAuth(<Trust />)} 
                  path="/trust" 
                />
                
                {/* Public routes */}
                <Route 
                  element={requireOnboarding(<Onboarding />)} 
                  path="/onboarding" 
                />
                <Route 
                  element={<Login />} 
                  path="/login" 
                />
                
                {/* Redirect root to dashboard */}
                <Route 
                  path="/" 
                  element={requireAuth(<Navigate to="/dashboard" replace />)} 
                />
                
                {/* 404 */}
                <Route 
                  path="*" 
                  element={<NotFound />} 
                />
              </Routes>
            </div>
          </div>
        </div>
      </Router>
    </AppProvider>
  );
};

// Helper functions to check auth and onboarding status
const requireAuth = (element: JSX.Element) => {
  // In a real app, you would check the auth context
  // For now, we'll just return the element
  return element;
};

const requireOnboarding = (element: JSX.Element) => {
  // In a real app, you would check if onboarding is complete
  // For now, we'll just return the element
  return element;
};

export default App;
