import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaUser, FaCog, FaSignOutAlt, FaBars, FaTimes } from 'react-icons/fa';
import logoImage from '../../assets/images/UCV.png';

const Navbar: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileAccountOpen, setIsMobileAccountOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleProfileDropdown = () => {
    setIsProfileDropdownOpen(!isProfileDropdownOpen);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Close dropdown and mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
        setIsMobileAccountOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isMobileMenuOpen]);

  const MobileDrawer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return createPortal(
      <>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black/60 z-[5000] md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
        )}
        <div
          className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-gray-200 shadow-xl transform transition-transform duration-200 ease-out md:hidden z-[5001] ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
          ref={mobileMenuRef}
        >
          {children}
        </div>
      </>,
      document.body
    );
  };

  if (!isAuthenticated) {
    return (
      <nav className="bg-white/95 backdrop-blur-md shadow-lg border-b border-blue-100 sticky top-0 z-[3000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Hamburger (mobile) + Brand */}
            <div className="flex items-center space-x-3">
              <button
                aria-label="Open menu"
                className="md:hidden mr-1 p-2 rounded-lg hover:bg-gray-100 text-gray-700"
                onClick={toggleMobileMenu}
              >
                <FaBars className="w-5 h-5" />
              </button>
              <img 
                src={logoImage}
                alt="Unified Calendar View Logo"
                className="w-10 h-10 md:w-12 md:h-12 rounded-xl shadow-lg object-cover"
              />
              <Link 
                to="/" 
                className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
              >
                Unified Calendar View
              </Link>
            </div>

            {/* Right actions - hidden on mobile */}
            <div className="hidden md:flex items-center space-x-3">
              <Link
                to="/login"
                className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors duration-200"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile slide-in drawer via portal to avoid stacking/transform issues */}
        <MobileDrawer>
          <div className="h-16 px-4 flex items-center justify-between border-b">
            <div className="flex items-center space-x-2">
              <img src={logoImage} alt="Unified Calendar View Logo" className="w-9 h-9 rounded-lg object-cover" />
              <span className="text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Unified Calendar View</span>
            </div>
            <button aria-label="Close menu" className="p-2 rounded-lg hover:bg-gray-100" onClick={toggleMobileMenu} type="button">
              <FaTimes className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-left px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">Sign In</Link>
            <Link to="/register" onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-left px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700">Get Started</Link>
          </div>
        </MobileDrawer>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Hamburger (mobile) + Brand */}
          <div className="flex items-center space-x-3">
            <button
              aria-label="Open menu"
              className="md:hidden mr-1 p-2 rounded-lg hover:bg-gray-100 text-gray-700"
              onClick={toggleMobileMenu}
            >
              <FaBars className="w-5 h-5" />
            </button>
            <img 
              src={logoImage}
              alt="Unified Calendar View Logo"
              className="w-10 h-10 md:w-12 md:h-12 rounded-xl shadow-lg object-cover"
            />
            <Link 
              to="/" 
              className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
            >
              Unified Calendar View
            </Link>
          </div>

          {/* Right Side Actions - hidden on mobile */}
          <div className="hidden md:flex items-center space-x-3">
            <Link
              to="/dashboard"
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm"
            >
              Go to Dashboard
            </Link>

            {/* User Menu */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={toggleProfileDropdown}
                className="flex items-center gap-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                  <FaUser className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700">{user?.email}</span>
              </button>

              {/* Profile Dropdown */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <button
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <FaCog className="w-4 h-4" />
                    Account Info
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <FaSignOutAlt className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile slide-in drawer via portal */}
      <MobileDrawer>
        <div className="h-16 px-4 flex items-center justify-between border-b">
          <div className="flex items-center space-x-2">
            <img src={logoImage} alt="Unified Calendar View Logo" className="w-9 h-9 rounded-lg object-cover" />
            <span className="text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Unified Calendar View</span>
          </div>
          <button aria-label="Close menu" className="p-2 rounded-lg hover:bg-gray-100" onClick={toggleMobileMenu} type="button">
            <FaTimes className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-left px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700">Go to Dashboard</Link>

          {/* Collapsible account section */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setIsMobileAccountOpen(prev => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
              type="button"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                  <FaUser className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700 truncate max-w-[180px]">{user?.email}</span>
              </div>
              <span className={`transition-transform ${isMobileAccountOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {isMobileAccountOpen && (
              <div className="border-t border-gray-200 p-2 bg-gray-50">
                <button
                  onClick={() => { setIsMobileMenuOpen(false); setIsMobileAccountOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-white flex items-center gap-2 text-sm"
                  type="button"
                >
                  <FaCog className="w-4 h-4" />
                  Account Info
                </button>
                <button
                  onClick={() => { setIsMobileAccountOpen(false); setIsMobileMenuOpen(false); handleLogout(); }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-white flex items-center gap-2 text-sm text-red-600"
                  type="button"
                >
                  <FaSignOutAlt className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </MobileDrawer>
    </nav>
  );
};

export default Navbar;