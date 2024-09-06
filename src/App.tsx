import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import CompletedOnboarding from './pages/CompletedOnboarding';
import WorkoutPreviewer from './pages/WorkoutPreviewer';
import Checklist from './pages/Checklist';


const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacyPolicy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/completeOnboarding" element={<CompletedOnboarding />} />
        <Route path="*" element={<div>404 Not Found</div>} />
        <Route path="/workoutPreview" element={< WorkoutPreviewer />} />
        <Route path="/starterpack" element={< Checklist />} />

      </Routes>
    </Router>
  );
}

export default App;