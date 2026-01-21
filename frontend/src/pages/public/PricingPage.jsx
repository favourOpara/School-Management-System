import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Check,
  X,
  ArrowRight,
  Sparkles,
  Menu,
  ChevronDown,
  Building2,
} from 'lucide-react';
import './PricingPage.css';

const plans = [
  {
    name: 'Free Trial',
    description: 'Perfect for trying out EduCare',
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      { text: '1 Admin Account', included: true },
      { text: '300 Emails/Day', included: true },
      { text: 'Student Management', included: true },
      { text: 'Basic Reports', included: true },
      { text: 'CSV Import', included: false },
      { text: 'Priority Support', included: false },
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Basic',
    description: 'For small schools getting started',
    monthlyPrice: 15000,
    annualPrice: 150000,
    features: [
      { text: '1 Admin Account', included: true },
      { text: '300 Emails/Day', included: true },
      { text: 'Student Management', included: true },
      { text: 'Basic Reports', included: true },
      { text: 'CSV Import', included: false },
      { text: 'Priority Support', included: false },
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Standard',
    description: 'Most popular for growing schools',
    monthlyPrice: 35000,
    annualPrice: 350000,
    features: [
      { text: '4 Admin Accounts', included: true },
      { text: '1,000 Emails/Day', included: true },
      { text: 'Student Management', included: true },
      { text: 'Advanced Reports', included: true },
      { text: 'CSV Import', included: true },
      { text: 'Priority Support', included: false },
    ],
    cta: 'Get Started',
    popular: true,
  },
  {
    name: 'Premium',
    description: 'For large institutions',
    monthlyPrice: 75000,
    annualPrice: 750000,
    features: [
      { text: '6 Admin Accounts', included: true },
      { text: 'Unlimited Emails', included: true },
      { text: 'Student Management', included: true },
      { text: 'Advanced Reports', included: true },
      { text: 'CSV Import', included: true },
      { text: 'Priority Support', included: true },
    ],
    cta: 'Get Started',
    popular: false,
  },
];

const faqs = [
  {
    question: 'Can I try EduCare before subscribing?',
    answer: 'Yes! We offer a 30-day free trial with full access to all features. No credit card required to start.',
  },
  {
    question: 'How does billing work?',
    answer: 'You can choose between monthly or annual billing. Annual plans save you up to 17%. Payment is processed securely through Paystack.',
  },
  {
    question: 'Can I upgrade or downgrade my plan?',
    answer: 'Absolutely! You can change your plan at any time. When upgrading, you\'ll be prorated for the remainder of your billing period.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major payment methods through Paystack including cards, bank transfers, and USSD.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes! We use bank-grade 256-bit SSL encryption, daily backups, and are fully NDPR compliant. Your data is safe with us.',
  },
];

const enterpriseFeatures = [
  'Unlimited admin accounts',
  'Custom integrations',
  'Dedicated support',
  'Custom branding',
];

function PricingPage() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const formatPrice = (price) => {
    if (price === 0) return 'Free';
    return `₦${price.toLocaleString()}`;
  };

  const handlePlanSelect = (plan) => {
    navigate('/register', { state: { planId: plan.name.toLowerCase(), annual } });
  };

  return (
    <div className="pricing-page">
      {/* Navigation */}
      <nav className="pricing-nav">
        <div className="pricing-nav-container">
          <Link to="/" className="pricing-logo">
            <div className="pricing-logo-icon">
              <GraduationCap />
            </div>
            <span className="pricing-logo-text">EduCare</span>
          </Link>

          <div className="pricing-nav-links">
            <Link to="/" className="pricing-nav-link">Home</Link>
            <Link to="/contact-sales" className="pricing-nav-link">Contact</Link>
            <button onClick={() => navigate('/register')} className="pricing-nav-cta">
              Get Started
            </button>
          </div>

          <button
            className="pricing-mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        <div className={`pricing-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="pricing-mobile-menu-links">
            <Link to="/" className="pricing-mobile-link">Home</Link>
            <Link to="/contact-sales" className="pricing-mobile-link">Contact</Link>
            <button onClick={() => navigate('/register')} className="pricing-mobile-cta">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pricing-hero">
        <div className="pricing-hero-container">
          <div className="pricing-hero-badge">
            <Sparkles />
            <span>Simple, Transparent Pricing</span>
          </div>
          <h1 className="pricing-hero-title">
            <span className="pricing-hero-title-dark">Choose the Perfect Plan</span>
            <span className="pricing-hero-title-gradient">For Your School</span>
          </h1>
          <p className="pricing-hero-subtitle">
            Start with a 30-day free trial. No credit card required.
          </p>

          <div className="pricing-toggle">
            <button
              className={`pricing-toggle-btn ${!annual ? 'active' : ''}`}
              onClick={() => setAnnual(false)}
            >
              Monthly
            </button>
            <button
              className={`pricing-toggle-btn ${annual ? 'active' : ''}`}
              onClick={() => setAnnual(true)}
            >
              Annual
              <span className="pricing-toggle-save">Save 17%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Plans Section */}
      <section className="pricing-plans">
        <div className="pricing-plans-grid">
          {plans.map((plan, index) => (
            <div key={index} className={`pricing-plan-card ${plan.popular ? 'popular' : ''}`}>
              {plan.popular && (
                <span className="pricing-plan-popular-badge">Most Popular</span>
              )}
              <div className="pricing-plan-header">
                <h3 className="pricing-plan-name">{plan.name}</h3>
                <p className="pricing-plan-description">{plan.description}</p>
              </div>
              <div className="pricing-plan-price">
                <span className="pricing-plan-amount">
                  {formatPrice(annual ? plan.annualPrice : plan.monthlyPrice)}
                </span>
                {plan.monthlyPrice > 0 && (
                  <span className="pricing-plan-period">/{annual ? 'year' : 'month'}</span>
                )}
              </div>
              <div className="pricing-plan-features">
                <ul className="pricing-plan-features-list">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className={`pricing-plan-feature ${!feature.included ? 'disabled' : ''}`}>
                      {feature.included ? (
                        <Check className="check" />
                      ) : (
                        <X className="x" />
                      )}
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => handlePlanSelect(plan)}
                className={`pricing-plan-btn ${plan.popular ? 'primary' : 'secondary'}`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Enterprise Section */}
      <section className="pricing-enterprise">
        <div className="pricing-enterprise-container">
          <div className="pricing-enterprise-content">
            <h2>Need a Custom Solution?</h2>
            <p>
              For large institutions with unique requirements, we offer custom enterprise plans with dedicated support and features.
            </p>
            <div className="pricing-enterprise-features">
              {enterpriseFeatures.map((feature, index) => (
                <div key={index} className="pricing-enterprise-feature">
                  <Check />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/contact-sales')} className="pricing-enterprise-btn">
              Contact Sales
              <ArrowRight size={20} />
            </button>
          </div>
          <div className="pricing-enterprise-visual">
            <div className="pricing-enterprise-card">
              <div className="pricing-enterprise-card-header">
                <div className="pricing-enterprise-card-icon">
                  <Building2 />
                </div>
                <div>
                  <div className="pricing-enterprise-card-title">Enterprise</div>
                  <div className="pricing-enterprise-card-subtitle">Custom Solution</div>
                </div>
              </div>
              <div className="pricing-enterprise-card-stats">
                <div className="pricing-enterprise-stat">
                  <div className="pricing-enterprise-stat-value">∞</div>
                  <div className="pricing-enterprise-stat-label">Admins</div>
                </div>
                <div className="pricing-enterprise-stat">
                  <div className="pricing-enterprise-stat-value">∞</div>
                  <div className="pricing-enterprise-stat-label">Emails</div>
                </div>
                <div className="pricing-enterprise-stat">
                  <div className="pricing-enterprise-stat-value">24/7</div>
                  <div className="pricing-enterprise-stat-label">Support</div>
                </div>
                <div className="pricing-enterprise-stat">
                  <div className="pricing-enterprise-stat-value">99.9%</div>
                  <div className="pricing-enterprise-stat-label">Uptime</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="pricing-faq">
        <div className="pricing-faq-header">
          <h2 className="pricing-faq-title">Frequently Asked Questions</h2>
          <p className="pricing-faq-subtitle">Everything you need to know about our pricing</p>
        </div>
        <div className="pricing-faq-list">
          {faqs.map((faq, index) => (
            <div key={index} className={`pricing-faq-item ${openFaq === index ? 'open' : ''}`}>
              <button
                className="pricing-faq-question"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
              >
                <span>{faq.question}</span>
                <ChevronDown />
              </button>
              <div className="pricing-faq-answer">
                {faq.answer}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="pricing-cta">
        <div className="pricing-cta-container">
          <h2>Ready to Get Started?</h2>
          <p>Join 500+ schools already using EduCare to streamline their operations.</p>
          <button onClick={() => navigate('/register')} className="pricing-cta-btn">
            Start Your Free Trial
            <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="pricing-footer">
        <div className="pricing-footer-container">
          <div className="pricing-footer-brand">
            <div className="pricing-footer-logo">
              <GraduationCap />
            </div>
            <span className="pricing-footer-name">EduCare</span>
          </div>
          <div className="pricing-footer-links">
            <Link to="/">Home</Link>
            <Link to="/contact-sales">Contact</Link>
            <Link to="/register">Register</Link>
          </div>
          <p className="pricing-footer-copyright">
            © {new Date().getFullYear()} EduCare. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default PricingPage;
