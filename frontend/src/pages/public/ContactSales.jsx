import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  Phone,
  MapPin,
  Check,
  Loader2,
  Users,
  Shield,
  Headphones,
  Globe,
  Zap,
  Building2,
  ArrowRight,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { API_ENDPOINTS } from '../../config';
import './ContactSales.css';

const enterpriseBenefits = [
  { icon: Users, text: 'Unlimited admin accounts', description: 'Add as many administrators as you need' },
  { icon: Globe, text: 'Custom branding and domain', description: 'Your school, your identity' },
  { icon: Headphones, text: 'Dedicated account manager', description: 'Personal support for your team' },
  { icon: Shield, text: 'Priority support 24/7', description: "We're always here when you need us" },
  { icon: Zap, text: 'Custom integrations', description: 'Connect with your existing tools' },
  { icon: Building2, text: 'Data migration assistance', description: 'Seamless transition from your current system' },
];

function ContactSales() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [formData, setFormData] = useState({
    school_name: '',
    contact_name: '',
    email: '',
    phone: '',
    message: '',
    expected_students: '',
    expected_staff: '',
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.school_name.trim()) {
      newErrors.school_name = 'School name is required';
    }
    if (!formData.contact_name.trim()) {
      newErrors.contact_name = 'Your name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (!formData.message.trim()) {
      newErrors.message = 'Please tell us about your requirements';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_ENDPOINTS.base}/api/public/contact-sales/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          expected_students: formData.expected_students
            ? parseInt(formData.expected_students)
            : null,
          expected_staff: formData.expected_staff
            ? parseInt(formData.expected_staff)
            : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit inquiry');
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contact-page">
      {/* Navigation */}
      <nav className="contact-nav">
        <div className="contact-nav-container">
          <Link to="/" className="contact-logo">
            <img src="/logo.svg" alt="EduCare" style={{height: '60px', width: 'auto'}} />
          </Link>

          <div className="contact-nav-links">
            <Link to="/" className="contact-nav-link">Home</Link>
            <Link to="/pricing" className="contact-nav-link">Pricing</Link>
            <button onClick={() => navigate('/register')} className="contact-nav-cta">
              Get Started
            </button>
          </div>

          <button
            className="contact-mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        <div className={`contact-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="contact-mobile-menu-links">
            <Link to="/" className="contact-mobile-link">Home</Link>
            <Link to="/pricing" className="contact-mobile-link">Pricing</Link>
            <button onClick={() => navigate('/register')} className="contact-mobile-cta">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="contact-hero">
        <div className="contact-hero-bg-1" />
        <div className="contact-hero-bg-2" />
        <div className="contact-hero-container">
          <div className="contact-hero-badge">
            <Sparkles />
            <span>Enterprise Solutions</span>
          </div>
          <h1 className="contact-hero-title">
            <span className="contact-hero-title-dark">Let's Build Something</span>
            <span className="contact-hero-title-gradient">Amazing Together</span>
          </h1>
          <p className="contact-hero-subtitle">
            Looking for a custom solution tailored to your institution's unique needs?
            Our enterprise team is ready to help you transform your school management.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="contact-main">
        <div className="contact-main-container">
          <div className="contact-grid">
            {/* Sidebar */}
            <div className="contact-sidebar">
              {/* Contact Info Cards */}
              <div className="contact-info-cards">
                <div className="contact-info-card">
                  <div className="contact-info-icon blue">
                    <Mail />
                  </div>
                  <div>
                    <div className="contact-info-label">Email</div>
                    <div className="contact-info-value">sales@educare.ng</div>
                  </div>
                </div>
                <div className="contact-info-card">
                  <div className="contact-info-icon green">
                    <Phone />
                  </div>
                  <div>
                    <div className="contact-info-label">Phone</div>
                    <div className="contact-info-value">+234 800 123 4567</div>
                  </div>
                </div>
                <div className="contact-info-card">
                  <div className="contact-info-icon purple">
                    <MapPin />
                  </div>
                  <div>
                    <div className="contact-info-label">Office</div>
                    <div className="contact-info-value">Lagos, Nigeria</div>
                  </div>
                </div>
              </div>

              {/* Benefits Card */}
              <div className="contact-benefits-card">
                <div className="contact-benefits-bg-1" />
                <div className="contact-benefits-bg-2" />
                <div className="contact-benefits-content">
                  <h3 className="contact-benefits-title">
                    <Sparkles />
                    Enterprise Benefits
                  </h3>
                  <div className="contact-benefits-list">
                    {enterpriseBenefits.map((benefit, index) => {
                      const Icon = benefit.icon;
                      return (
                        <div key={index} className="contact-benefit-item">
                          <div className="contact-benefit-icon">
                            <Icon />
                          </div>
                          <div className="contact-benefit-text">
                            <strong>{benefit.text}</strong>
                            <span>{benefit.description}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="contact-form-wrapper">
              {success ? (
                <div className="contact-success">
                  <div className="contact-success-icon">
                    <Check />
                  </div>
                  <h2>Thank You!</h2>
                  <p>
                    We've received your inquiry. Our sales team will reach out to you
                    within 24 hours to discuss your requirements.
                  </p>
                  <button onClick={() => navigate('/')} className="contact-success-btn">
                    Return to Home
                    <ArrowRight size={20} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="contact-form-header">
                    <h2>Tell Us About Your School</h2>
                    <p>Fill out the form and we'll get back to you promptly.</p>
                  </div>

                  {error && (
                    <div className="contact-form-error">
                      <X />
                      <p>{error}</p>
                    </div>
                  )}

                  <div className="contact-form-fields">
                    <div className="contact-form-group">
                      <label className="contact-form-label">School Name *</label>
                      <input
                        type="text"
                        name="school_name"
                        value={formData.school_name}
                        onChange={handleChange}
                        placeholder="Enter your school name"
                        className={`contact-form-input ${errors.school_name ? 'error' : ''}`}
                      />
                      {errors.school_name && (
                        <div className="contact-form-field-error">
                          <X />
                          {errors.school_name}
                        </div>
                      )}
                    </div>

                    <div className="contact-form-row">
                      <div className="contact-form-group">
                        <label className="contact-form-label">Your Name *</label>
                        <input
                          type="text"
                          name="contact_name"
                          value={formData.contact_name}
                          onChange={handleChange}
                          placeholder="John Doe"
                          className={`contact-form-input ${errors.contact_name ? 'error' : ''}`}
                        />
                        {errors.contact_name && (
                          <div className="contact-form-field-error">
                            <X />
                            {errors.contact_name}
                          </div>
                        )}
                      </div>
                      <div className="contact-form-group">
                        <label className="contact-form-label">Email Address *</label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="john@school.edu"
                          className={`contact-form-input ${errors.email ? 'error' : ''}`}
                        />
                        {errors.email && (
                          <div className="contact-form-field-error">
                            <X />
                            {errors.email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="contact-form-group">
                      <label className="contact-form-label">Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+234 800 000 0000"
                        className="contact-form-input"
                      />
                    </div>

                    <div className="contact-form-row">
                      <div className="contact-form-group">
                        <label className="contact-form-label">Expected Students</label>
                        <input
                          type="number"
                          name="expected_students"
                          value={formData.expected_students}
                          onChange={handleChange}
                          placeholder="e.g., 500"
                          className="contact-form-input"
                        />
                      </div>
                      <div className="contact-form-group">
                        <label className="contact-form-label">Expected Staff</label>
                        <input
                          type="number"
                          name="expected_staff"
                          value={formData.expected_staff}
                          onChange={handleChange}
                          placeholder="e.g., 50"
                          className="contact-form-input"
                        />
                      </div>
                    </div>

                    <div className="contact-form-group">
                      <label className="contact-form-label">Tell us about your requirements *</label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        placeholder="What features are most important to you? Do you have any specific requirements or integrations needed?"
                        className={`contact-form-input ${errors.message ? 'error' : ''}`}
                      />
                      {errors.message && (
                        <div className="contact-form-field-error">
                          <X />
                          {errors.message}
                        </div>
                      )}
                    </div>

                    <button type="submit" disabled={loading} className="contact-form-submit">
                      {loading ? (
                        <>
                          <Loader2 className="contact-spinner" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          Submit Inquiry
                          <ArrowRight />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="contact-trust">
        <div className="contact-trust-container">
          <h2>Trusted by Leading Institutions</h2>
          <p>Join hundreds of schools already using EduCare</p>
          <div className="contact-trust-logos">
            {['University of Lagos', 'Kings College', 'Queens College', 'Corona Schools'].map((name, index) => (
              <div key={index} className="contact-trust-logo">{name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="contact-footer">
        <div className="contact-footer-container">
          <div className="contact-footer-brand">
            <img src="/logo-white.svg" alt="EduCare" style={{height: '60px', width: 'auto'}} />
          </div>
          <div className="contact-footer-links">
            <Link to="/">Home</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/register">Register</Link>
          </div>
          <p className="contact-footer-copyright">
            © {new Date().getFullYear()} EduCare. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default ContactSales;
