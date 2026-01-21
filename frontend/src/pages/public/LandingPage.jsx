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
  Star,
  Menu,
  X,
  BookOpen,
  Bell,
  Calendar,
  TrendingUp,
  Globe,
} from 'lucide-react';
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
];

const stats = [
  { value: '500+', label: 'Schools Trust Us', icon: GraduationCap },
  { value: '50K+', label: 'Students Managed', icon: Users },
  { value: '99.9%', label: 'Uptime Guarantee', icon: TrendingUp },
  { value: '24/7', label: 'Support Available', icon: Globe },
];

const testimonials = [
  {
    name: 'Mrs. Adebayo Folake',
    role: 'Principal',
    school: 'Lagos International Academy',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    quote: 'EduCare transformed our administrative processes. What used to take days now takes minutes. Our teachers can focus on teaching, not paperwork.',
    rating: 5,
  },
  {
    name: 'Mr. Chukwuemeka Obi',
    role: 'School Administrator',
    school: 'Victory Heights School',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    quote: 'The fee management system alone has saved us countless hours. Parents love the transparency and easy payment options through Paystack.',
    rating: 5,
  },
  {
    name: 'Dr. Amina Ibrahim',
    role: 'Director of Education',
    school: 'Crescent Schools Group',
    image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=100&h=100&fit=crop&crop=face',
    quote: 'We manage 5 schools with EduCare. The multi-tenant system and analytics give us complete visibility across all our institutions.',
    rating: 5,
  },
];

const benefits = [
  'Start with 30-day free trial - no credit card required',
  'Set up your school in under 10 minutes',
  'Import existing data from Excel/CSV files',
  'Dedicated onboarding support team',
  'Regular feature updates at no extra cost',
  'Bank-grade security and data encryption',
  'NDPR and GDPR compliant',
  'Export your data anytime',
];

const securityFeatures = [
  '256-bit SSL encryption',
  'Daily automated backups',
  'NDPR compliant data handling',
  'Role-based access control',
  '99.9% uptime SLA',
];

function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
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
            <Link to="/contact-sales" className="landing-nav-link">Contact</Link>
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
            <Link to="/contact-sales" className="landing-mobile-link">Contact</Link>
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
        </div>
        <div className="landing-hero-pattern" />

        <div className="landing-hero-content">
          <div className="landing-hero-grid">
            <div className="landing-hero-text">
              <div className="landing-hero-badge">
                <span className="landing-hero-badge-dot" />
                <span className="landing-hero-badge-text">Trusted by 500+ Nigerian Schools</span>
              </div>

              <h1 className="landing-hero-title">
                The Future of
                <span className="landing-hero-title-gradient">School Management</span>
              </h1>

              <p className="landing-hero-description">
                Streamline admissions, automate report cards, collect fees online, and manage your entire school from one powerful platform.
              </p>

              <div className="landing-hero-buttons">
                <button onClick={() => navigate('/register')} className="landing-hero-btn-primary">
                  Start Free Trial
                  <ArrowRight size={20} />
                </button>
                <button onClick={() => navigate('/pricing')} className="landing-hero-btn-secondary">
                  View Plans
                  <ArrowRight size={20} />
                </button>
              </div>

              <div className="landing-hero-social-proof">
                <div className="landing-hero-avatars">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="landing-hero-avatar" />
                  ))}
                </div>
                <div className="landing-hero-rating">
                  <div className="landing-hero-stars">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} />
                    ))}
                  </div>
                  <p className="landing-hero-reviews">From 2,000+ reviews</p>
                </div>
              </div>
            </div>

            <div className="landing-hero-preview">
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
                        <span>educare.com/figilschools/admin</span>
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
                        {/* Header */}
                        <div className="landing-hero-content-header">
                          <div>
                            <p className="landing-hero-welcome">Welcome back, Admin</p>
                            <p className="landing-hero-school-name">Figil International Schools</p>
                          </div>
                          <div className="landing-hero-header-actions">
                            <div className="landing-hero-notification">
                              <Bell size={14} />
                              <span className="landing-hero-notification-badge">3</span>
                            </div>
                          </div>
                        </div>

                        {/* Stats Grid */}
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

                        {/* Chart Area */}
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

      {/* Stats Section */}
      <section className="landing-stats">
        <div className="landing-stats-container">
          <div className="landing-stats-grid">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="landing-stat-item">
                  <div className="landing-stat-icon">
                    <Icon />
                  </div>
                  <p className="landing-stat-value">{stat.value}</p>
                  <p className="landing-stat-label">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-features">
        <div className="landing-features-container">
          <div className="landing-features-header">
            <span className="landing-features-badge">POWERFUL FEATURES</span>
            <h2 className="landing-features-title">Everything Your School Needs</h2>
            <p className="landing-features-subtitle">
              A complete suite of tools designed specifically for Nigerian schools to manage operations efficiently.
            </p>
          </div>

          <div className="landing-features-grid">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="landing-feature-card">
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

      {/* Benefits Section */}
      <section className="landing-benefits">
        <div className="landing-benefits-pattern" />
        <div className="landing-benefits-container">
          <div className="landing-benefits-grid">
            <div>
              <span className="landing-benefits-badge">WHY CHOOSE EDUCARE</span>
              <h2 className="landing-benefits-title">Built for Nigerian Schools, By Nigerians</h2>
              <div className="landing-benefits-list">
                {benefits.map((benefit, index) => (
                  <div key={index} className="landing-benefit-item">
                    <div className="landing-benefit-check">
                      <CheckCircle size={16} />
                    </div>
                    <span className="landing-benefit-text">{benefit}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate('/register')} className="landing-benefits-cta">
                Start Your Free Trial
                <ArrowRight size={20} />
              </button>
            </div>

            <div className="landing-security-card">
              <div className="landing-security-header">
                <div className="landing-security-icon">
                  <Shield />
                </div>
                <h3 className="landing-security-title">Enterprise-Grade Security</h3>
              </div>
              <div className="landing-security-list">
                {securityFeatures.map((item, i) => (
                  <div key={i} className="landing-security-item">
                    <CheckCircle />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="landing-testimonials">
        <div className="landing-testimonials-container">
          <div className="landing-testimonials-header">
            <span className="landing-testimonials-badge">TESTIMONIALS</span>
            <h2 className="landing-testimonials-title">Loved by Schools Across Nigeria</h2>
            <p className="landing-testimonials-subtitle">
              Join hundreds of schools that have transformed their operations with EduCare.
            </p>
          </div>

          <div className="landing-testimonials-grid">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="landing-testimonial-card">
                <div className="landing-testimonial-stars">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} />
                  ))}
                </div>
                <p className="landing-testimonial-quote">"{testimonial.quote}"</p>
                <div className="landing-testimonial-author">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="landing-testimonial-avatar"
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(testimonial.name)}&background=3b82f6&color=fff`;
                    }}
                  />
                  <div>
                    <p className="landing-testimonial-name">{testimonial.name}</p>
                    <p className="landing-testimonial-role">{testimonial.role}, {testimonial.school}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-cta-section">
        <div className="landing-cta-container">
          <div className="landing-cta-card">
            <div className="landing-cta-pattern" />
            <div className="landing-cta-content">
              <h2 className="landing-cta-title">Ready to Transform Your School?</h2>
              <p className="landing-cta-description">
                Join 500+ schools already using EduCare. Start your free 30-day trial today — no credit card required.
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
                The modern school management platform built for Nigerian schools.
              </p>
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
