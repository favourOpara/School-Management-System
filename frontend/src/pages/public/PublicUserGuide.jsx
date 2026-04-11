import React, { useState, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Shield, BookOpen, Users, UserCheck, User, Building2 } from 'lucide-react';
import './PublicUserGuide.css';

const UserGuide = React.lazy(() => import('../../components/UserGuide'));

const roles = [
  { id: 'admin', label: 'Admin', icon: Shield },
  { id: 'teacher', label: 'Teacher', icon: BookOpen },
  { id: 'student', label: 'Student', icon: Users },
  { id: 'parent', label: 'Parent', icon: User },
  { id: 'principal', label: 'Principal', icon: UserCheck },
  { id: 'proprietor', label: 'Proprietor', icon: Building2 },
];

export default function PublicUserGuide() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState('admin');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="pub-kb-page">
      {/* Navigation — same as landing page */}
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="landing-nav-container">
          <Link to="/" className="landing-logo">
            <img src="/logo.svg" alt="InsightWick" style={{height: '60px', width: 'auto'}} />
          </Link>

          <div className="landing-nav-links">
            <Link to="/pricing" className="landing-nav-link">Pricing</Link>
            <Link to="/user-guide" className="landing-nav-link active">User Guide</Link>
            <Link to="/contact-sales" className="landing-nav-link">Contact</Link>
            <button onClick={() => navigate('/portal')} className="landing-signin-btn">Sign In</button>
            <button onClick={() => navigate('/register')} className="landing-cta-btn">Get Started Free</button>
          </div>

          <button className="landing-mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        <div className={`landing-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="landing-mobile-menu-links">
            <Link to="/pricing" className="landing-mobile-link">Pricing</Link>
            <Link to="/user-guide" className="landing-mobile-link">User Guide</Link>
            <Link to="/contact-sales" className="landing-mobile-link">Contact</Link>
            <button onClick={() => { setMobileMenuOpen(false); navigate('/portal'); }} className="landing-mobile-signin">Sign In</button>
            <button onClick={() => navigate('/register')} className="landing-mobile-cta">Get Started Free</button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="pub-kb-content">
        {/* Role selector tabs */}
        <div className="pub-kb-role-bar">
          <div className="pub-kb-role-tabs">
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <button
                  key={role.id}
                  className={`pub-kb-role-tab${selectedRole === role.id ? ' active' : ''}`}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <Icon size={16} />
                  <span>{role.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Suspense fallback={<div className="kb-loading">Loading...</div>}>
          <UserGuide userRole={selectedRole} />
        </Suspense>
      </div>

      {/* Footer */}
      <footer className="pub-kb-footer">
        <p>© {new Date().getFullYear()} InsightWick. All rights reserved.</p>
      </footer>
    </div>
  );
}
