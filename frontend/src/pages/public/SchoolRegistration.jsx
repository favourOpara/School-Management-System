import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  Building2,
  User,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Shield,
  Menu,
  Mail,
  Phone,
  MapPin,
  Lock,
} from 'lucide-react';
import { API_ENDPOINTS } from '../../config';
import './SchoolRegistration.css';

const steps = [
  { id: 0, name: 'School Info', icon: Building2 },
  { id: 1, name: 'Admin Account', icon: User },
  { id: 2, name: 'Select Plan', icon: CreditCard },
];

function SchoolRegistration() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [formData, setFormData] = useState({
    school_name: '',
    school_email: '',
    school_phone: '',
    school_address: '',
    admin_first_name: '',
    admin_last_name: '',
    admin_email: '',
    admin_password: '',
    admin_password_confirm: '',
    plan_id: location.state?.planId || '',
    billing_cycle: location.state?.annual ? 'annual' : 'monthly',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.school_name.length >= 3) {
        checkSlugAvailability(formData.school_name);
      } else {
        setSlugAvailable(null);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.school_name]);

  const fetchPlans = async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.base}/api/public/plans/`);
      if (response.ok) {
        const data = await response.json();
        setPlans(data);
        if (!formData.plan_id && data.length > 0) {
          const freePlan = data.find((p) => p.name === 'free');
          if (freePlan) {
            setFormData((prev) => ({ ...prev, plan_id: freePlan.id }));
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setLoadingPlans(false);
    }
  };

  const checkSlugAvailability = async (name) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    if (slug.length < 3) {
      setSlugAvailable(null);
      return;
    }

    setCheckingSlug(true);
    try {
      const response = await fetch(
        `${API_ENDPOINTS.base}/api/public/check-slug/${slug}/`
      );
      const data = await response.json();
      setSlugAvailable(data.available);
    } catch (err) {
      setSlugAvailable(null);
    } finally {
      setCheckingSlug(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 0) {
      if (!formData.school_name.trim()) {
        newErrors.school_name = 'School name is required';
      } else if (formData.school_name.length < 3) {
        newErrors.school_name = 'School name must be at least 3 characters';
      }
      if (!formData.school_email.trim()) {
        newErrors.school_email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.school_email)) {
        newErrors.school_email = 'Invalid email address';
      }
      if (slugAvailable === false) {
        newErrors.school_name = 'A school with this name already exists';
      }
    }

    if (step === 1) {
      if (!formData.admin_first_name.trim()) {
        newErrors.admin_first_name = 'First name is required';
      }
      if (!formData.admin_last_name.trim()) {
        newErrors.admin_last_name = 'Last name is required';
      }
      if (!formData.admin_email.trim()) {
        newErrors.admin_email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin_email)) {
        newErrors.admin_email = 'Invalid email address';
      }
      if (!formData.admin_password) {
        newErrors.admin_password = 'Password is required';
      } else if (formData.admin_password.length < 8) {
        newErrors.admin_password = 'Password must be at least 8 characters';
      } else if (!/[A-Z]/.test(formData.admin_password)) {
        newErrors.admin_password = 'Password must contain an uppercase letter';
      } else if (!/[a-z]/.test(formData.admin_password)) {
        newErrors.admin_password = 'Password must contain a lowercase letter';
      } else if (!/[0-9]/.test(formData.admin_password)) {
        newErrors.admin_password = 'Password must contain a number';
      }
      if (formData.admin_password !== formData.admin_password_confirm) {
        newErrors.admin_password_confirm = 'Passwords do not match';
      }
    }

    if (step === 2) {
      if (!formData.plan_id) {
        newErrors.plan_id = 'Please select a plan';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(2)) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_ENDPOINTS.base}/api/public/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          school_name: formData.school_name,
          school_email: formData.school_email,
          school_phone: formData.school_phone,
          school_address: formData.school_address,
          admin_first_name: formData.admin_first_name,
          admin_last_name: formData.admin_last_name,
          admin_email: formData.admin_email,
          admin_password: formData.admin_password,
          plan_id: formData.plan_id,
          billing_cycle: formData.billing_cycle,
          callback_url: `${window.location.origin}/payment/callback`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || Object.values(data).flat().join(', '));
      }

      if (data.payment?.authorization_url) {
        window.location.href = data.payment.authorization_url;
      } else {
        setSuccess(true);
        setTimeout(() => {
          const slug = formData.school_name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-');
          navigate(`/${slug}`);
        }, 3000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (kobo) => {
    if (kobo === 0) return 'Free';
    return `₦${(kobo / 100).toLocaleString()}`;
  };

  const getSlug = () => {
    return formData.school_name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const selectedPlan = plans.find((p) => p.id === formData.plan_id);

  const passwordStrength = () => {
    let strength = 0;
    if (formData.admin_password.length >= 8) strength++;
    if (/[A-Z]/.test(formData.admin_password)) strength++;
    if (/[a-z]/.test(formData.admin_password)) strength++;
    if (/[0-9]/.test(formData.admin_password)) strength++;
    if (/[^A-Za-z0-9]/.test(formData.admin_password)) strength++;
    return strength;
  };

  const getStrengthClass = () => {
    const strength = passwordStrength();
    if (strength <= 2) return 'weak';
    if (strength <= 3) return 'medium';
    return 'strong';
  };

  const getStrengthText = () => {
    const strength = passwordStrength();
    if (strength <= 2) return 'Weak';
    if (strength <= 3) return 'Medium';
    return 'Strong';
  };

  return (
    <div className="register-page">
      {/* Navigation */}
      <nav className="register-nav">
        <div className="register-nav-container">
          <Link to="/" className="register-logo">
            <div className="register-logo-icon">
              <GraduationCap />
            </div>
            <span className="register-logo-text">EduCare</span>
          </Link>

          <div className="register-nav-links">
            <Link to="/pricing" className="register-nav-link">Pricing</Link>
            <Link to="/contact-sales" className="register-nav-link">Contact Sales</Link>
          </div>

          <button
            className="register-mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        <div className={`register-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="register-mobile-menu-links">
            <Link to="/pricing" className="register-mobile-link">Pricing</Link>
            <Link to="/contact-sales" className="register-mobile-link">Contact Sales</Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="register-main">
        <div className="register-container">
          {/* Header */}
          <div className="register-header">
            <div className="register-badge">
              <Sparkles />
              <span>30-Day Free Trial</span>
            </div>
            <h1 className="register-title">Register Your School</h1>
            <p className="register-subtitle">
              Get started in minutes. No credit card required for free trial.
            </p>
          </div>

          {/* Stepper */}
          <div className="register-stepper">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="register-step">
                  <div
                    className={`register-step-icon ${
                      index < activeStep
                        ? 'completed'
                        : index === activeStep
                        ? 'active'
                        : ''
                    }`}
                  >
                    {index < activeStep ? (
                      <Check />
                    ) : (
                      <step.icon />
                    )}
                  </div>
                  <span
                    className={`register-step-name ${
                      index <= activeStep ? 'active' : ''
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`register-step-connector ${
                      index < activeStep ? 'completed' : ''
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Form Card */}
          {success ? (
            <div className="register-card register-success">
              <div className="register-success-icon">
                <Check />
              </div>
              <h2 className="register-success-title">Registration Successful!</h2>
              <p className="register-success-text">
                We've sent a verification email to <strong>{formData.admin_email}</strong>
              </p>
              <p className="register-success-subtext">
                Please verify your email to activate your account.
              </p>
              <div className="register-success-redirect">
                <Loader2 className="register-spinner" />
                <span>Redirecting to your dashboard...</span>
              </div>
            </div>
          ) : (
            <div className="register-card">
              {/* Progress bar */}
              <div className="register-progress-bar">
                <div
                  className="register-progress-fill"
                  style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
                />
              </div>

              <div className="register-card-content">
                {error && (
                  <div className="register-error">
                    <X />
                    <p>{error}</p>
                  </div>
                )}

                {/* Step 1: School Information */}
                {activeStep === 0 && (
                  <div className="register-form-section">
                    <div className="register-section-header">
                      <h2>School Information</h2>
                      <p>Tell us about your educational institution</p>
                    </div>

                    <div className="register-form-group">
                      <label className="register-label">School Name *</label>
                      <div className="register-input-wrapper">
                        <div className="register-input-icon">
                          <Building2 />
                        </div>
                        <input
                          type="text"
                          name="school_name"
                          value={formData.school_name}
                          onChange={handleChange}
                          placeholder="Enter your school name"
                          className={`register-input ${errors.school_name ? 'error' : ''}`}
                        />
                        <div className="register-input-status">
                          {checkingSlug ? (
                            <Loader2 className="register-spinner" />
                          ) : slugAvailable === true ? (
                            <Check className="status-success" />
                          ) : slugAvailable === false ? (
                            <X className="status-error" />
                          ) : null}
                        </div>
                      </div>
                      {errors.school_name && (
                        <p className="register-field-error">
                          <X />
                          {errors.school_name}
                        </p>
                      )}
                      {formData.school_name && getSlug() && (
                        <div className="register-slug-preview">
                          <p>
                            Your school URL: <strong>educare.com/{getSlug()}</strong>
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="register-form-group">
                      <label className="register-label">School Email *</label>
                      <div className="register-input-wrapper">
                        <div className="register-input-icon">
                          <Mail />
                        </div>
                        <input
                          type="email"
                          name="school_email"
                          value={formData.school_email}
                          onChange={handleChange}
                          placeholder="info@yourschool.edu"
                          className={`register-input ${errors.school_email ? 'error' : ''}`}
                        />
                      </div>
                      {errors.school_email && (
                        <p className="register-field-error">
                          <X />
                          {errors.school_email}
                        </p>
                      )}
                    </div>

                    <div className="register-form-group">
                      <label className="register-label">Phone Number</label>
                      <div className="register-input-wrapper">
                        <div className="register-input-icon">
                          <Phone />
                        </div>
                        <input
                          type="tel"
                          name="school_phone"
                          value={formData.school_phone}
                          onChange={handleChange}
                          placeholder="+234 800 000 0000"
                          className="register-input"
                        />
                      </div>
                    </div>

                    <div className="register-form-group">
                      <label className="register-label">School Address</label>
                      <div className="register-input-wrapper textarea">
                        <div className="register-input-icon textarea">
                          <MapPin />
                        </div>
                        <textarea
                          name="school_address"
                          value={formData.school_address}
                          onChange={handleChange}
                          rows={2}
                          placeholder="Enter your school's full address"
                          className="register-input"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Admin Account */}
                {activeStep === 1 && (
                  <div className="register-form-section">
                    <div className="register-section-header">
                      <h2>Admin Account</h2>
                      <p>Create your administrator login credentials</p>
                    </div>

                    <div className="register-form-row">
                      <div className="register-form-group">
                        <label className="register-label">First Name *</label>
                        <input
                          type="text"
                          name="admin_first_name"
                          value={formData.admin_first_name}
                          onChange={handleChange}
                          placeholder="John"
                          className={`register-input ${errors.admin_first_name ? 'error' : ''}`}
                        />
                        {errors.admin_first_name && (
                          <p className="register-field-error">
                            <X />
                            {errors.admin_first_name}
                          </p>
                        )}
                      </div>
                      <div className="register-form-group">
                        <label className="register-label">Last Name *</label>
                        <input
                          type="text"
                          name="admin_last_name"
                          value={formData.admin_last_name}
                          onChange={handleChange}
                          placeholder="Doe"
                          className={`register-input ${errors.admin_last_name ? 'error' : ''}`}
                        />
                        {errors.admin_last_name && (
                          <p className="register-field-error">
                            <X />
                            {errors.admin_last_name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="register-form-group">
                      <label className="register-label">Admin Email *</label>
                      <div className="register-input-wrapper">
                        <div className="register-input-icon">
                          <Mail />
                        </div>
                        <input
                          type="email"
                          name="admin_email"
                          value={formData.admin_email}
                          onChange={handleChange}
                          placeholder="admin@yourschool.edu"
                          className={`register-input ${errors.admin_email ? 'error' : ''}`}
                        />
                      </div>
                      {errors.admin_email && (
                        <p className="register-field-error">
                          <X />
                          {errors.admin_email}
                        </p>
                      )}
                    </div>

                    <div className="register-form-group">
                      <label className="register-label">Password *</label>
                      <div className="register-input-wrapper">
                        <div className="register-input-icon">
                          <Lock />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="admin_password"
                          value={formData.admin_password}
                          onChange={handleChange}
                          placeholder="Create a strong password"
                          className={`register-input ${errors.admin_password ? 'error' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="register-password-toggle"
                        >
                          {showPassword ? <EyeOff /> : <Eye />}
                        </button>
                      </div>
                      {formData.admin_password && (
                        <div className="register-password-strength">
                          <div className="register-strength-bar">
                            <div
                              className={`register-strength-fill ${getStrengthClass()}`}
                              style={{ width: `${(passwordStrength() / 5) * 100}%` }}
                            />
                          </div>
                          <span className={`register-strength-text ${getStrengthClass()}`}>
                            {getStrengthText()}
                          </span>
                        </div>
                      )}
                      {errors.admin_password ? (
                        <p className="register-field-error">
                          <X />
                          {errors.admin_password}
                        </p>
                      ) : (
                        <p className="register-field-hint">
                          Min 8 characters with uppercase, lowercase, and number
                        </p>
                      )}
                    </div>

                    <div className="register-form-group">
                      <label className="register-label">Confirm Password *</label>
                      <div className="register-input-wrapper">
                        <div className="register-input-icon">
                          <Lock />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="admin_password_confirm"
                          value={formData.admin_password_confirm}
                          onChange={handleChange}
                          placeholder="Confirm your password"
                          className={`register-input ${errors.admin_password_confirm ? 'error' : ''}`}
                        />
                        {formData.admin_password_confirm && formData.admin_password === formData.admin_password_confirm && (
                          <div className="register-input-status">
                            <Check className="status-success" />
                          </div>
                        )}
                      </div>
                      {errors.admin_password_confirm && (
                        <p className="register-field-error">
                          <X />
                          {errors.admin_password_confirm}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 3: Select Plan */}
                {activeStep === 2 && (
                  <div className="register-form-section">
                    <div className="register-section-header">
                      <h2>Choose Your Plan</h2>
                      <p>Select the plan that best fits your school's needs</p>
                    </div>

                    {loadingPlans ? (
                      <div className="register-loading">
                        <Loader2 className="register-spinner" />
                      </div>
                    ) : (
                      <>
                        <div className="register-plans-grid">
                          {plans.map((plan) => (
                            <div
                              key={plan.id}
                              onClick={() => setFormData((prev) => ({ ...prev, plan_id: plan.id }))}
                              className={`register-plan-card ${
                                formData.plan_id === plan.id ? 'selected' : ''
                              }`}
                            >
                              {plan.name === 'standard' && (
                                <div className="register-plan-badge">
                                  <span>Most Popular</span>
                                </div>
                              )}

                              <div className="register-plan-header">
                                <h4>{plan.display_name}</h4>
                                {plan.name === 'free' && (
                                  <span className="register-plan-free-badge">30 days free</span>
                                )}
                              </div>

                              <p className="register-plan-price">
                                {formatPrice(
                                  formData.billing_cycle === 'annual'
                                    ? plan.annual_price
                                    : plan.monthly_price
                                )}
                                {plan.monthly_price > 0 && (
                                  <span className="register-plan-period">
                                    /{formData.billing_cycle === 'annual' ? 'year' : 'month'}
                                  </span>
                                )}
                              </p>

                              <div className="register-plan-features">
                                <div className="register-plan-feature">
                                  <Check />
                                  <span>{plan.max_admin_accounts} admin{plan.max_admin_accounts > 1 ? 's' : ''}</span>
                                </div>
                                <div className="register-plan-feature">
                                  <Check />
                                  <span>{plan.max_daily_emails === 0 ? 'Unlimited' : plan.max_daily_emails} emails/day</span>
                                </div>
                                {plan.has_import_feature && (
                                  <div className="register-plan-feature">
                                    <Check />
                                    <span>CSV Import</span>
                                  </div>
                                )}
                              </div>

                              {formData.plan_id === plan.id && (
                                <div className="register-plan-selected-icon">
                                  <Check />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {selectedPlan && selectedPlan.monthly_price > 0 && (
                          <div className="register-billing-section">
                            <label className="register-label">Billing Cycle</label>
                            <div className="register-billing-options">
                              <button
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, billing_cycle: 'monthly' }))}
                                className={`register-billing-option ${
                                  formData.billing_cycle === 'monthly' ? 'selected' : ''
                                }`}
                              >
                                <p className="register-billing-option-title">Monthly</p>
                                <p className="register-billing-option-price">{formatPrice(selectedPlan.monthly_price)}/month</p>
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, billing_cycle: 'annual' }))}
                                className={`register-billing-option ${
                                  formData.billing_cycle === 'annual' ? 'selected' : ''
                                }`}
                              >
                                <span className="register-billing-save-badge">
                                  Save {Math.round(
                                    ((selectedPlan.monthly_price * 12 - selectedPlan.annual_price) /
                                      (selectedPlan.monthly_price * 12)) *
                                      100
                                  )}%
                                </span>
                                <p className="register-billing-option-title">Annual</p>
                                <p className="register-billing-option-price">{formatPrice(selectedPlan.annual_price)}/year</p>
                              </button>
                            </div>
                          </div>
                        )}

                        {errors.plan_id && (
                          <p className="register-field-error">
                            <X />
                            {errors.plan_id}
                          </p>
                        )}

                        <div className="register-trial-notice">
                          <Shield />
                          <div>
                            <p className="register-trial-notice-title">30-Day Free Trial</p>
                            <p className="register-trial-notice-text">
                              All plans include a free trial. No payment required to start.
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="register-nav-buttons">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={activeStep === 0}
                    className={`register-back-btn ${activeStep === 0 ? 'disabled' : ''}`}
                  >
                    <ArrowLeft />
                    Back
                  </button>

                  {activeStep === steps.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={loading}
                      className="register-submit-btn"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="register-spinner" />
                          Processing...
                        </>
                      ) : selectedPlan?.monthly_price > 0 ? (
                        <>
                          Continue to Payment
                          <ArrowRight />
                        </>
                      ) : (
                        <>
                          Create Account
                          <ArrowRight />
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="register-next-btn"
                    >
                      Continue
                      <ArrowRight />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Login Link */}
          <p className="register-login-link">
            Already have an account?{' '}
            <Link to="/">Sign in here</Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="register-footer">
        <div className="register-footer-container">
          <div className="register-footer-brand">
            <div className="register-footer-logo">
              <GraduationCap />
            </div>
            <span className="register-footer-name">EduCare</span>
          </div>
          <div className="register-footer-links">
            <Link to="/pricing">Pricing</Link>
            <Link to="/contact-sales">Contact</Link>
          </div>
          <p className="register-footer-copyright">
            © {new Date().getFullYear()} EduCare. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default SchoolRegistration;
