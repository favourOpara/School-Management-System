import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2">
        <img src="/logo.png" alt="School Logo" className="h-10 w-auto max-w-[150px] object-contain" />
          <span className="font-semibold text-xl text-gray-800">Figil High School</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex space-x-6">
          <Link to="/" className="text-gray-700 hover:text-blue-600">Home</Link>
          <Link to="/dashboard" className="text-gray-700 hover:text-blue-600">Dashboard</Link>
          <Link to="/logout" className="text-gray-700 hover:text-blue-600">Logout</Link>
        </nav>

        {/* Hamburger */}
        <div className="md:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-700 focus:outline-none"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {isOpen && (
        <nav className="md:hidden px-4 pb-4 space-y-2 bg-white">
          <Link to="/" className="block text-gray-700 hover:text-blue-600">Home</Link>
          <Link to="/dashboard" className="block text-gray-700 hover:text-blue-600">Dashboard</Link>
          <Link to="/logout" className="block text-gray-700 hover:text-blue-600">Logout</Link>
        </nav>
      )}
    </header>
  );
};

export default Header;
