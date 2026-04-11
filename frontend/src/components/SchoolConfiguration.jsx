// src/components/SchoolConfiguration.jsx
import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  Save,
  Upload,
  AlertCircle,
  CheckCircle,
  Building2,
  Palette,
  Mail,
  Globe,
  Image,
  Loader2,
  X,
} from 'lucide-react';
import API_BASE_URL, { getSchoolSlug } from '../config';
import SchoolContext from '../contexts/SchoolContext';
import './SchoolConfiguration.css';

const SchoolConfiguration = () => {
  // Use context directly (returns null if not inside SchoolProvider, e.g. portal mode)
  const schoolContext = useContext(SchoolContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const fileInputRef = useRef(null);

  const [config, setConfig] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    accent_color: '#2563eb',
    secondary_color: '#4f46e5',
    email_sender_name: '',
    tagline: '',
    website: '',
  });

  useEffect(() => {
    fetchConfiguration();
  }, []);

  const fetchConfiguration = async () => {
    try {
      // Check if we're in portal mode
      const isPortalMode = localStorage.getItem('portalMode') === 'true';
      const token = localStorage.getItem(isPortalMode ? 'portalAccessToken' : 'accessToken');
      const schoolSlug = isPortalMode ? localStorage.getItem('portalSchoolSlug') : getSchoolSlug();

      // Use portal endpoint when in portal mode, school-scoped endpoint otherwise
      const endpoint = isPortalMode
        ? `${API_BASE_URL}/api/portal/school/configuration/`
        : schoolContext?.buildApiUrl
          ? schoolContext.buildApiUrl('/school/configuration/')
          : `${API_BASE_URL}/api/${schoolSlug}/school/configuration/`;

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConfig({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          accent_color: data.accent_color || '#2563eb',
          secondary_color: data.secondary_color || '#4f46e5',
          email_sender_name: data.email_sender_name || '',
          tagline: data.tagline || '',
          website: data.website || '',
        });
        if (data.logo) {
          setLogoPreview(data.logo);
        }
      }
    } catch (error) {
      showMessage('Error loading configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const handleChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showMessage('Logo file must be less than 5MB', 'error');
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        showMessage('Please upload a valid image file (JPEG, PNG, GIF, or WebP)', 'error');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Check if we're in portal mode
      const isPortalMode = localStorage.getItem('portalMode') === 'true';
      const token = localStorage.getItem(isPortalMode ? 'portalAccessToken' : 'accessToken');
      const schoolSlug = isPortalMode ? localStorage.getItem('portalSchoolSlug') : getSchoolSlug();

      const formData = new FormData();
      Object.entries(config).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      if (logoFile) {
        formData.append('logo', logoFile);
      }

      // Use portal endpoint when in portal mode, school-scoped endpoint otherwise
      const endpoint = isPortalMode
        ? `${API_BASE_URL}/api/portal/school/configuration/`
        : schoolContext?.buildApiUrl
          ? schoolContext.buildApiUrl('/school/configuration/')
          : `${API_BASE_URL}/api/${schoolSlug}/school/configuration/`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        showMessage('Configuration saved successfully!', 'success');
        setLogoFile(null);
      } else {
        const errorData = await response.json();
        const errorMsg = Object.values(errorData).flat().join(', ') || 'Error saving configuration';
        showMessage(errorMsg, 'error');
      }
    } catch (error) {
      showMessage('Error saving configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="school-config-loading">
        <Loader2 className="spinner" />
        <p>Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="school-config-container">
      <div className="school-config-header">
        <Building2 size={32} />
        <div>
          <h2>School Configuration</h2>
          <p>Customize your school's branding and settings</p>
        </div>
      </div>

      {message.text && (
        <div className={`school-config-message ${message.type}`}>
          {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="school-config-content">
        {/* Logo Section */}
        <div className="config-section">
          <div className="section-header">
            <Image size={20} />
            <h3>School Logo</h3>
          </div>
          <div className="logo-upload-area">
            {logoPreview ? (
              <div className="logo-preview-container">
                <img src={logoPreview} alt="School logo" className="logo-preview" />
                <button className="remove-logo-btn" onClick={handleRemoveLogo}>
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div
                className="logo-placeholder"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={32} />
                <p>Click to upload logo</p>
                <span>PNG, JPG, GIF up to 5MB</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoSelect}
              style={{ display: 'none' }}
            />
            {logoPreview && (
              <button
                className="change-logo-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} />
                Change Logo
              </button>
            )}
          </div>
        </div>

        {/* Colors Section */}
        <div className="config-section">
          <div className="section-header">
            <Palette size={20} />
            <h3>Brand Colors</h3>
          </div>
          <div className="color-pickers">
            <div className="color-picker-group">
              <label>Primary Accent Color</label>
              <div className="color-input-wrapper">
                <input
                  type="color"
                  value={config.accent_color}
                  onChange={(e) => handleChange('accent_color', e.target.value)}
                  className="color-input"
                />
                <input
                  type="text"
                  value={config.accent_color}
                  onChange={(e) => handleChange('accent_color', e.target.value)}
                  className="color-text-input"
                  placeholder="#2563eb"
                />
              </div>
              <p className="color-hint">Used for buttons, links, and highlights</p>
            </div>
            <div className="color-picker-group">
              <label>Secondary Color</label>
              <div className="color-input-wrapper">
                <input
                  type="color"
                  value={config.secondary_color}
                  onChange={(e) => handleChange('secondary_color', e.target.value)}
                  className="color-input"
                />
                <input
                  type="text"
                  value={config.secondary_color}
                  onChange={(e) => handleChange('secondary_color', e.target.value)}
                  className="color-text-input"
                  placeholder="#4f46e5"
                />
              </div>
              <p className="color-hint">Used for accents and gradients</p>
            </div>
          </div>
          <div className="color-preview">
            <p>Preview:</p>
            <div
              className="preview-button"
              style={{
                background: `linear-gradient(135deg, ${config.accent_color}, ${config.secondary_color})`,
              }}
            >
              Sample Button
            </div>
          </div>
        </div>

        {/* School Info Section */}
        <div className="config-section">
          <div className="section-header">
            <Building2 size={20} />
            <h3>School Information</h3>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>School Name</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter school name"
              />
            </div>
            <div className="form-group">
              <label>Tagline / Motto</label>
              <input
                type="text"
                value={config.tagline}
                onChange={(e) => handleChange('tagline', e.target.value)}
                placeholder="e.g., Excellence in Education"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={config.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="info@school.edu"
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={config.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+234 800 000 0000"
              />
            </div>
            <div className="form-group full-width">
              <label>Website</label>
              <div className="input-with-icon">
                <Globe size={18} />
                <input
                  type="url"
                  value={config.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="https://www.yourschool.edu"
                />
              </div>
            </div>
            <div className="form-group full-width">
              <label>Address</label>
              <textarea
                value={config.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Enter school address"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Email Settings Section */}
        <div className="config-section">
          <div className="section-header">
            <Mail size={20} />
            <h3>Email Settings</h3>
          </div>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Email Sender Name</label>
              <input
                type="text"
                value={config.email_sender_name}
                onChange={(e) => handleChange('email_sender_name', e.target.value)}
                placeholder="e.g., Greenwood Academy"
              />
              <p className="field-hint">
                This name will appear as the sender when emails are sent from your school.
                Emails will be sent from: <strong>{config.email_sender_name || config.name || 'Your School'} &lt;noreply@insightwick.com&gt;</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="config-actions">
          <button
            className="save-config-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="spinner" size={18} />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchoolConfiguration;
