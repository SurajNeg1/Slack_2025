import React from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import {Routes, Route, Navigate} from 'react-router';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';

const App = () => {
  return (
   <header>
      <SignedIn>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<Navigate to="/" replace />} />
        </Routes>
        {/* <UserButton /> */}
      </SignedIn>
      <SignedOut>
          <Routes>
         
          <Route path="/auth" element={<AuthPage />} />
           <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
        {/* <SignInButton mode="modal"/> */}
      </SignedOut>
    </header>
  )
}

export default App
