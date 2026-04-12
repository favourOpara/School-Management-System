import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  X,
  ArrowRight,
  Sparkles,
  Menu,
  ChevronDown,
  Building2,
  HeartHandshake,
} from 'lucide-react';
import './PricingPage.css';

const plans = [
  {
    name: 'Basic',
    description: 'For small schools getting started',
    monthlyPrice: 20000,
    annualPrice: 200000,
    maxStudents: 300,
    features: [
      { text: '300 Emails/Day', included: true },
      { text: '2 Admin Accounts', included: true },
      { text: '2 Principal Accounts', included: true },
      { text: '300 Student & Parent Accounts', included: true },
      { text: '20 Teacher Accounts', included: true },
      { text: 'Student Academics, Attendance & Grades', included: true },
      { text: 'Analytics Dashboard', included: true },
      { text: 'No Proprietor Account', included: false },
      { text: 'XLSX Import', included: false },
      { text: 'Priority Support', included: false },
    ],
    popular: false,
  },
  {
    name: 'Standard',
    description: 'Most popular for growing schools',
    monthlyPrice: 40000,
    annualPrice: 400000,
    maxStudents: 700,
    features: [
      { text: '700 Emails/Day', included: true },
      { text: '4 Admin Accounts', included: true },
      { text: '4 Principal Accounts', included: true },
      { text: '700 Student & Parent Accounts', included: true },
      { text: '70 Teacher Accounts', included: true },
      { text: 'Student Academics, Attendance & Grades', included: true },
      { text: 'Analytics Dashboard', included: true },
      { text: 'XLSX Import (100 rows/import)', included: true },
      { text: 'Download Database', included: true },
      { text: '1 Proprietor Account', included: true },
      { text: 'Priority Support', included: false },
    ],
    popular: true,
  },
  {
    name: 'Premium',
    description: 'For large institutions',
    monthlyPrice: 75000,
    annualPrice: 750000,
    maxStudents: 1000,
    features: [
      { text: '2,000 Emails/Day', included: true },
      { text: '7 Admin Accounts', included: true },
      { text: '2 Proprietor Accounts', included: true },
      { text: '7 Principal Accounts', included: true },
      { text: '1,000 Student & Parent Accounts', included: true },
      { text: '150 Teacher Accounts', included: true },
      { text: 'Student Academics, Attendance & Grades', included: true },
      { text: 'Analytics Dashboard', included: true },
      { text: 'XLSX Import (500 rows/import)', included: true },
      { text: 'Download Database', included: true },
      { text: 'Teacher Attendance Marking', included: true },
      { text: 'Guidance Counsellor Account', included: true, comingSoon: true },
      { text: 'Staff Management Platform', included: true },
      { text: 'AI Lesson Note Review (Admin)', included: true, aiFeature: true },
      { text: 'AI Academic Assistant (Students)', included: true, aiFeature: true },
      { text: 'Priority Support', included: true },
    ],
    popular: false,
  },
];

const faqs = [
  {
    question: 'Can I try InsightWick before subscribing?',
    answer: 'Yes! Every plan includes two free trial options — a 30-day trial or a termly trial (4 months, roughly one full school term). Both include full access to all features in the chosen plan with no credit card required. After your trial ends, you\'ll be invited to subscribe to continue.',
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

  const handlePlanSelect = (plan, registrationType) => {
    navigate('/register', {
      state: {
        planId: plan.name.toLowerCase(),
        annual,
        registrationType,
      }
    });
  };

  return (
    <div className="pricing-page">
      {/* Navigation */}
      <nav className="pricing-nav">
        <div className="pricing-nav-container">
          <Link to="/" className="pricing-logo">
            <img src="/logo.svg" alt="InsightWick" style={{height: '60px', width: 'auto'}} />
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
            Start with a 30-day or full termly (4-month) free trial. No credit card required.
          </p>

          {/* Onboarding promise — prominent in hero */}
          <div className="pricing-onboarding-hero-badge">
            <div className="pricing-onboarding-hero-badge-icon">
              <HeartHandshake size={22} />
            </div>
            <div className="pricing-onboarding-hero-badge-text">
              <strong>Free expert onboarding included with every plan.</strong>
              <span> Our specialist sets up your students, teachers, classes & more within 24 hours — no DIY.</span>
            </div>
          </div>

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
                <span className="pricing-plan-trial-badge">30-day or 4-month free trial</span>
              </div>
              <div className="pricing-plan-price">
                <span className="pricing-plan-amount">
                  {formatPrice(annual ? plan.annualPrice : plan.monthlyPrice)}
                </span>
                {plan.monthlyPrice > 0 && (
                  <span className="pricing-plan-period">/{annual ? 'year' : 'month'}</span>
                )}
              </div>
              {plan.monthlyPrice > 0 && (
                <div className="pricing-per-student">
                  {(() => {
                    const price = annual ? plan.annualPrice : plan.monthlyPrice;
                    const months = annual ? 12 : 1;
                    const perStudent = Math.round(price / (plan.maxStudents * months));
                    return (
                      <>
                        <span className="pricing-per-student-amount">₦{perStudent.toLocaleString()}</span>
                        <span className="pricing-per-student-label"> per student/month</span>
                      </>
                    );
                  })()}
                </div>
              )}
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
                      {feature.comingSoon && (
                        <span className="pricing-feature-badge coming-soon">Coming Soon</span>
                      )}
                      {feature.aiFeature && (
                        <span className="pricing-feature-badge ai-feature">✨ AI</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pricing-plan-actions">
                <button
                  onClick={() => handlePlanSelect(plan, 'trial')}
                  className="pricing-plan-btn primary"
                >
                  30-Day Free Trial
                </button>
                <button
                  onClick={() => handlePlanSelect(plan, 'termly_trial')}
                  className="pricing-plan-btn primary"
                >
                  Termly Trial — 4 Months
                </button>
                <button
                  onClick={() => handlePlanSelect(plan, 'subscribe')}
                  className="pricing-plan-btn secondary"
                >
                  Subscribe Now
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Onboarding Callout */}
      <section className="pricing-onboarding-callout">
        <div className="pricing-onboarding-callout-inner">
          <div className="pricing-onboarding-callout-icon">
            <HeartHandshake size={32} />
          </div>
          <div className="pricing-onboarding-callout-text">
            <h3>Free Expert Onboarding — Included with Every Plan</h3>
            <p>
              After you sign up, a dedicated InsightWick onboarding specialist will reach out within 24 hours
              to personally help you set up students, teachers, classes, subjects, parents, and more.
              No extra cost. No DIY headaches.
            </p>
          </div>
          <button onClick={() => navigate('/register')} className="pricing-onboarding-callout-btn">
            Get Started Free
            <ArrowRight size={18} />
          </button>
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
          <p>Start your free trial today and see why schools choose InsightWick.</p>
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
            <img src="/logo-white.svg" alt="InsightWick" style={{height: '60px', width: 'auto'}} />
          </div>
          <div className="pricing-footer-links">
            <Link to="/">Home</Link>
            <Link to="/contact-sales">Contact</Link>
            <Link to="/register">Register</Link>
          </div>
          <p className="pricing-footer-copyright">
            © {new Date().getFullYear()} InsightWick. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default PricingPage;
