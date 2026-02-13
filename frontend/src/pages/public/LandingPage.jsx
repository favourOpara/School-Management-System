import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Users,
  BarChart3,
  CreditCard,
  Shield,
  CheckCircle,
  ArrowRight,
  Menu,
  X,
  BookOpen,
  Bell,
  Calendar,
  Zap,
  Eye,
  ShieldCheck,
  FileText,
  ClipboardCheck,
  Layers,
  Upload,
  Building2,
  Settings,
  Rocket,
  Lock,
  Database,
  KeyRound,
  Activity,
  Cloud,
  Sparkles,
} from 'lucide-react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import './LandingPage.css';

const features = [
  {
    icon: Users,
    title: 'Student Management',
    description: 'Complete student lifecycle management from admission to graduation with detailed profiles and academic tracking.',
    color: 'blue',
  },
  {
    icon: BarChart3,
    title: 'Smart Analytics',
    description: 'Real-time dashboards and insights to track performance, attendance trends, and institutional growth.',
    color: 'purple',
  },
  {
    icon: CreditCard,
    title: 'Fee Management',
    description: 'Automated invoicing, online payments via Paystack, and comprehensive financial reporting.',
    color: 'green',
  },
  {
    icon: BookOpen,
    title: 'Academic Excellence',
    description: 'Curriculum planning, assignment management, and automated grade calculations with report cards.',
    color: 'orange',
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    description: 'Automated emails and SMS alerts for fees, attendance, grades, and important announcements.',
    color: 'pink',
  },
  {
    icon: Calendar,
    title: 'Attendance Tracking',
    description: 'Digital attendance with real-time parent notifications and comprehensive attendance reports.',
    color: 'cyan',
  },
  {
    icon: FileText,
    title: 'Report Cards',
    description: 'Automated report card generation with customizable grading scales, class rankings, and downloadable PDFs.',
    color: 'indigo',
  },
  {
    icon: Users,
    title: 'Multi-Role Access',
    description: 'Dedicated dashboards for admins, principals, teachers, students, and parents with role-specific tools.',
    color: 'teal',
  },
  {
    icon: ClipboardCheck,
    title: 'Exam & Test Management',
    description: 'Create, schedule, and grade exams with automatic score computation and subject-level analytics.',
    color: 'red',
  },
  {
    icon: Layers,
    title: 'Class & Session Management',
    description: 'Organize students by class, arm, and academic session with seamless term-to-term transitions.',
    color: 'amber',
  },
  {
    icon: CreditCard,
    title: 'Paystack Integration',
    description: 'Accept fee payments online through Paystack with automatic receipt generation and payment tracking.',
    color: 'emerald',
  },
  {
    icon: Upload,
    title: 'Data Import & Export',
    description: 'Bulk import students from Excel/CSV and export any data for external reporting.',
    color: 'slate',
  },
];

const valuePillars = [
  {
    icon: Zap,
    title: 'Built for Efficiency',
    description: 'Automate repetitive tasks like report cards, attendance tracking, and fee collection so your staff can focus on what matters.',
    color: 'blue',
  },
  {
    icon: Eye,
    title: 'Complete Visibility',
    description: 'Real-time dashboards give administrators, teachers, and parents instant insight into every aspect of school operations.',
    color: 'purple',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by Design',
    description: 'Enterprise-grade encryption, role-based access, and NDPR compliance keep your school data safe and protected.',
    color: 'green',
  },
];

const howItWorks = [
  {
    step: 1,
    icon: Building2,
    title: 'Register Your School',
    description: 'Create your school account in minutes. Choose your plan and configure your school profile.',
  },
  {
    step: 2,
    icon: Settings,
    title: 'Set Up Your System',
    description: 'Add classes, subjects, and teachers. Import existing student data from Excel spreadsheets.',
  },
  {
    step: 3,
    icon: Rocket,
    title: 'Start Managing',
    description: 'Your school is live. Track attendance, manage fees, generate report cards, and more.',
  },
];

const securityBadges = [
  { icon: Lock, title: '256-bit SSL Encryption' },
  { icon: Database, title: 'Daily Automated Backups' },
  { icon: Shield, title: 'NDPR & GDPR Compliant' },
  { icon: KeyRound, title: 'Role-Based Access Control' },
  { icon: Activity, title: '99.9% Uptime SLA' },
  { icon: Cloud, title: 'Secure Cloud Hosting' },
];

function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    AOS.init({
      duration: 800,
      easing: 'ease-out-cubic',
      once: true,
      offset: 80,
    });

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="landing-nav-container">
          <Link to="/" className="landing-logo">
            <div className="landing-logo-icon">
              <GraduationCap />
            </div>
            <span className="landing-logo-text">EduCare</span>
          </Link>

          <div className="landing-nav-links">
            <Link to="/pricing" className="landing-nav-link">Pricing</Link>
            <Link to="/knowledge-base" className="landing-nav-link">Knowledge Base</Link>
            <Link to="/contact-sales" className="landing-nav-link">Contact</Link>
            <button onClick={() => navigate('/portal')} className="landing-signin-btn">
              Sign In
            </button>
            <button onClick={() => navigate('/register')} className="landing-cta-btn">
              Get Started Free
            </button>
          </div>

          <button
            className="landing-mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        <div className={`landing-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="landing-mobile-menu-links">
            <Link to="/pricing" className="landing-mobile-link">Pricing</Link>
            <Link to="/knowledge-base" className="landing-mobile-link">Knowledge Base</Link>
            <Link to="/contact-sales" className="landing-mobile-link">Contact</Link>
            <button onClick={() => { setMobileMenuOpen(false); navigate('/portal'); }} className="landing-mobile-signin">
              Sign In
            </button>
            <button onClick={() => navigate('/register')} className="landing-mobile-cta">
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-bg">
          <div className="landing-hero-blob landing-hero-blob-1" />
          <div className="landing-hero-blob landing-hero-blob-2" />
          <div className="landing-hero-blob landing-hero-blob-3" />

          {/* Geometric decorative shapes */}
          <svg className="landing-geo landing-geo-dotted-circle" viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="80" stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeDasharray="8 6" />
          </svg>
          <svg className="landing-geo landing-geo-dots" viewBox="0 0 100 100" fill="none">
            {[0, 1, 2, 3, 4].map(row =>
              [0, 1, 2, 3, 4].map(col => (
                <circle key={`${row}-${col}`} cx={10 + col * 20} cy={10 + row * 20} r="2.5" fill="rgba(255,255,255,0.15)" />
              ))
            )}
          </svg>
          <svg className="landing-geo landing-geo-ring" viewBox="0 0 120 120" fill="none">
            <circle cx="60" cy="60" r="50" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <circle cx="60" cy="60" r="35" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
          </svg>
          <svg className="landing-geo landing-geo-cross" viewBox="0 0 60 60" fill="none">
            <line x1="0" y1="30" x2="60" y2="30" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
            <line x1="30" y1="0" x2="30" y2="60" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
          </svg>
        </div>
        <div className="landing-hero-pattern" />

        <div className="landing-hero-content">
          <div className="landing-hero-grid">
            <div className="landing-hero-text">
              <div className="landing-hero-badge" data-aos="fade-down">
                <Sparkles size={16} />
                <span className="landing-hero-badge-text">All-in-One School Management Platform</span>
              </div>

              <h1 className="landing-hero-title" data-aos="fade-up" data-aos-delay="100">
                The Future of
                <span className="landing-hero-title-gradient">School Management</span>
              </h1>

              <p className="landing-hero-description" data-aos="fade-up" data-aos-delay="200">
                Streamline admissions, automate report cards, collect fees online, and manage your entire school from one powerful platform.
              </p>

              <div className="landing-hero-buttons" data-aos="fade-up" data-aos-delay="300">
                <button onClick={() => navigate('/register')} className="landing-hero-btn-primary">
                  Get Started, It's Free
                  <ArrowRight size={20} />
                </button>
                <button onClick={() => navigate('/pricing')} className="landing-hero-btn-secondary">
                  View Plans
                  <ArrowRight size={20} />
                </button>
              </div>

              <div className="landing-hero-highlights" data-aos="fade-up" data-aos-delay="400">
                <div className="landing-hero-highlight-item">
                  <CheckCircle size={16} />
                  <span>No credit card required</span>
                </div>
                <div className="landing-hero-highlight-item">
                  <CheckCircle size={16} />
                  <span>Set up in 10 minutes</span>
                </div>
                <div className="landing-hero-highlight-item">
                  <CheckCircle size={16} />
                  <span>Free plan available</span>
                </div>
              </div>
            </div>

            <div className="landing-hero-preview" data-aos="fade-left" data-aos-delay="200">
              <div className="landing-hero-dashboard">
                <div className="landing-hero-dashboard-frame">
                  <div className="landing-hero-dashboard-inner">
                    {/* Browser Header */}
                    <div className="landing-hero-browser-header">
                      <div className="landing-hero-dashboard-dots">
                        <div className="landing-hero-dashboard-dot red" />
                        <div className="landing-hero-dashboard-dot yellow" />
                        <div className="landing-hero-dashboard-dot green" />
                      </div>
                      <div className="landing-hero-browser-url">
                        <Shield size={12} />
                        <span>educare.com/yourschool/admin</span>
                      </div>
                    </div>

                    {/* Dashboard Layout */}
                    <div className="landing-hero-dashboard-layout">
                      {/* Sidebar */}
                      <div className="landing-hero-sidebar">
                        <div className="landing-hero-sidebar-logo">
                          <GraduationCap size={16} />
                          <span>EduCare</span>
                        </div>
                        <div className="landing-hero-sidebar-menu">
                          <div className="landing-hero-sidebar-item active">
                            <BarChart3 size={14} />
                            <span>Dashboard</span>
                          </div>
                          <div className="landing-hero-sidebar-item">
                            <Users size={14} />
                            <span>Students</span>
                          </div>
                          <div className="landing-hero-sidebar-item">
                            <BookOpen size={14} />
                            <span>Classes</span>
                          </div>
                          <div className="landing-hero-sidebar-item">
                            <CreditCard size={14} />
                            <span>Fees</span>
                          </div>
                          <div className="landing-hero-sidebar-item">
                            <Calendar size={14} />
                            <span>Attendance</span>
                          </div>
                        </div>
                      </div>

                      {/* Main Content */}
                      <div className="landing-hero-main-content">
                        <div className="landing-hero-content-header">
                          <div>
                            <p className="landing-hero-welcome">Welcome back, Admin</p>
                            <p className="landing-hero-school-name">Your School Name</p>
                          </div>
                          <div className="landing-hero-header-actions">
                            <div className="landing-hero-notification">
                              <Bell size={14} />
                              <span className="landing-hero-notification-badge">3</span>
                            </div>
                          </div>
                        </div>

                        <div className="landing-hero-stats-grid">
                          <div className="landing-hero-stat-card blue">
                            <div className="landing-hero-stat-card-icon">
                              <Users size={16} />
                            </div>
                            <div className="landing-hero-stat-card-info">
                              <p className="landing-hero-stat-card-value">1,234</p>
                              <p className="landing-hero-stat-card-label">Total Students</p>
                            </div>
                          </div>
                          <div className="landing-hero-stat-card green">
                            <div className="landing-hero-stat-card-icon">
                              <CheckCircle size={16} />
                            </div>
                            <div className="landing-hero-stat-card-info">
                              <p className="landing-hero-stat-card-value">94.2%</p>
                              <p className="landing-hero-stat-card-label">Attendance</p>
                            </div>
                          </div>
                          <div className="landing-hero-stat-card purple">
                            <div className="landing-hero-stat-card-icon">
                              <CreditCard size={16} />
                            </div>
                            <div className="landing-hero-stat-card-info">
                              <p className="landing-hero-stat-card-value">₦2.4M</p>
                              <p className="landing-hero-stat-card-label">Fees Collected</p>
                            </div>
                          </div>
                          <div className="landing-hero-stat-card orange">
                            <div className="landing-hero-stat-card-icon">
                              <BookOpen size={16} />
                            </div>
                            <div className="landing-hero-stat-card-info">
                              <p className="landing-hero-stat-card-value">48</p>
                              <p className="landing-hero-stat-card-label">Teachers</p>
                            </div>
                          </div>
                        </div>

                        <div className="landing-hero-chart-section">
                          <div className="landing-hero-chart-header">
                            <p>Student Enrollment Trend</p>
                            <span>This Year</span>
                          </div>
                          <div className="landing-hero-chart">
                            <div className="landing-hero-chart-bars">
                              <div className="landing-hero-chart-bar" style={{height: '45%'}}><span>Jan</span></div>
                              <div className="landing-hero-chart-bar" style={{height: '60%'}}><span>Feb</span></div>
                              <div className="landing-hero-chart-bar" style={{height: '55%'}}><span>Mar</span></div>
                              <div className="landing-hero-chart-bar" style={{height: '70%'}}><span>Apr</span></div>
                              <div className="landing-hero-chart-bar" style={{height: '65%'}}><span>May</span></div>
                              <div className="landing-hero-chart-bar" style={{height: '85%'}}><span>Jun</span></div>
                              <div className="landing-hero-chart-bar highlight" style={{height: '90%'}}><span>Jul</span></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="landing-floating-card landing-floating-card-1">
                <div className="landing-floating-card-inner">
                  <div className="landing-floating-card-icon green">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <p className="landing-floating-card-title">Fee Paid</p>
                    <p className="landing-floating-card-subtitle">₦45,000 received</p>
                  </div>
                </div>
              </div>

              <div className="landing-floating-card landing-floating-card-2">
                <div className="landing-floating-card-inner">
                  <div className="landing-floating-card-icon blue">
                    <Users size={24} />
                  </div>
                  <div>
                    <p className="landing-floating-card-title">New Enrollment</p>
                    <p className="landing-floating-card-subtitle">+12 this week</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="landing-hero-wave">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* Value Proposition Pillars */}
      <section className="landing-pillars">
        <div className="landing-pillars-container">
          <div className="landing-pillars-grid">
            {valuePillars.map((pillar, index) => {
              const Icon = pillar.icon;
              return (
                <div key={index} className="landing-pillar-card" data-aos="fade-up" data-aos-delay={index * 100}>
                  <div className={`landing-pillar-icon ${pillar.color}`}>
                    <Icon size={28} />
                  </div>
                  <h3 className="landing-pillar-title">{pillar.title}</h3>
                  <p className="landing-pillar-description">{pillar.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="landing-features">
        <div className="landing-features-container">
          <div className="landing-features-header" data-aos="fade-up">
            <span className="landing-features-badge">POWERFUL FEATURES</span>
            <h2 className="landing-features-title">Everything Your School Needs</h2>
            <p className="landing-features-subtitle">
              A complete suite of tools designed specifically for schools to manage operations efficiently.
            </p>
          </div>

          <div className="landing-features-grid">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="landing-feature-card" data-aos="fade-up" data-aos-delay={(index % 3) * 100}>
                  <div className={`landing-feature-icon ${feature.color}`}>
                    <Icon />
                  </div>
                  <h3 className="landing-feature-title">{feature.title}</h3>
                  <p className="landing-feature-description">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="landing-how-it-works">
        <div className="landing-how-container">
          <div className="landing-how-header" data-aos="fade-up">
            <span className="landing-how-badge">HOW IT WORKS</span>
            <h2 className="landing-how-title">Get Started in 3 Simple Steps</h2>
            <p className="landing-how-subtitle">
              From registration to full school management in minutes, not months.
            </p>
          </div>

          <div className="landing-how-steps">
            {howItWorks.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="landing-how-step" data-aos="fade-up" data-aos-delay={index * 150}>
                  <div className="landing-how-step-number">{step.step}</div>
                  <div className="landing-how-step-icon">
                    <Icon size={32} />
                  </div>
                  <h3 className="landing-how-step-title">{step.title}</h3>
                  <p className="landing-how-step-description">{step.description}</p>
                  {index < howItWorks.length - 1 && (
                    <div className="landing-how-step-connector" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="landing-how-cta" data-aos="fade-up" data-aos-delay="300">
            <button onClick={() => navigate('/register')} className="landing-how-cta-btn">
              Get Started Free — No Credit Card Required
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* Security & Compliance */}
      <section className="landing-security-section">
        <div className="landing-security-section-pattern" />
        <div className="landing-security-section-container">
          <div className="landing-security-section-header" data-aos="fade-up">
            <span className="landing-security-section-badge">SECURITY & COMPLIANCE</span>
            <h2 className="landing-security-section-title">Enterprise-Grade Security</h2>
            <p className="landing-security-section-subtitle">
              Your school data is protected with industry-leading security standards.
            </p>
          </div>

          <div className="landing-security-section-grid">
            {securityBadges.map((badge, index) => {
              const Icon = badge.icon;
              return (
                <div key={index} className="landing-security-badge" data-aos="fade-up" data-aos-delay={index * 80}>
                  <div className="landing-security-badge-icon">
                    <Icon size={28} />
                  </div>
                  <p className="landing-security-badge-title">{badge.title}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-cta-section">
        <div className="landing-cta-container" data-aos="zoom-in">
          <div className="landing-cta-card">
            <div className="landing-cta-pattern" />
            <div className="landing-cta-content">
              <h2 className="landing-cta-title">Ready to Transform Your School?</h2>
              <p className="landing-cta-description">
                Start your free trial today — no credit card required. Set up your school in under 10 minutes.
              </p>
              <div className="landing-cta-buttons">
                <button onClick={() => navigate('/register')} className="landing-cta-btn-primary">
                  Start Free Trial
                  <ArrowRight size={20} />
                </button>
                <button onClick={() => navigate('/contact-sales')} className="landing-cta-btn-secondary">
                  Talk to Sales
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="landing-footer-grid">
            <div>
              <div className="landing-footer-brand">
                <div className="landing-footer-logo">
                  <GraduationCap />
                </div>
                <span className="landing-footer-name">EduCare</span>
              </div>
              <p className="landing-footer-description">
                The modern school management platform built for schools that want to do more with less.
              </p>
              <div className="landing-footer-social">
                <a href="#" className="landing-footer-social-link" aria-label="Twitter">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="#" className="landing-footer-social-link" aria-label="LinkedIn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
                <a href="#" className="landing-footer-social-link" aria-label="Facebook">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
              </div>
            </div>

            <div className="landing-footer-column">
              <h4>Product</h4>
              <ul className="landing-footer-links">
                <li><Link to="/pricing">Pricing</Link></li>
                <li><a href="#features">Features</a></li>
                <li><Link to="/register">Free Trial</Link></li>
              </ul>
            </div>

            <div className="landing-footer-column">
              <h4>Company</h4>
              <ul className="landing-footer-links">
                <li><a href="#about">About Us</a></li>
                <li><Link to="/contact-sales">Contact</Link></li>
                <li><a href="#careers">Careers</a></li>
              </ul>
            </div>

            <div className="landing-footer-column">
              <h4>Contact</h4>
              <ul className="landing-footer-links">
                <li>support@educare.ng</li>
                <li>+234 800 123 4567</li>
                <li>Lagos, Nigeria</li>
              </ul>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <p className="landing-footer-copyright">
              © {new Date().getFullYear()} EduCare. All rights reserved.
            </p>
            <div className="landing-footer-legal">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
