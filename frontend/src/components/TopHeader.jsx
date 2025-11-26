import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Menu, User, Camera, ChevronDown, X, Settings, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './TopHeader.css';

const TopHeader = ({ onMenuClick, onSettingsClick, onPasswordChangeClick }) => {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchUserProfile();

    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://127.0.0.1:8000/api/users/profile/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAvatarUrl(data.avatar_url);
        setUserName(`${data.first_name} ${data.last_name}`);
        setUserRole(data.role);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
    window.location.reload();
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a JPEG, PNG, GIF, or WebP image.');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum size is 5MB.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://127.0.0.1:8000/api/users/avatar/upload/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setAvatarUrl(data.avatar_url);
        setShowUploadModal(false);
        alert('Profile picture updated successfully!');
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to upload avatar');
      }
    } catch (err) {
      alert('Error uploading avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Remove your profile picture?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://127.0.0.1:8000/api/users/avatar/remove/', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setAvatarUrl(null);
        alert('Profile picture removed');
      }
    } catch (err) {
      alert('Error removing avatar');
    }
  };

  return (
    <>
      <div className="top-header">
        <div className="top-header-left">
          {onMenuClick && (
            <button className="top-hamburger-btn" onClick={onMenuClick}>
              <Menu size={24} />
            </button>
          )}
        </div>
        <div className="top-header-right">
          <div className="account-dropdown" ref={dropdownRef}>
            <button
              className="account-btn"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <div className="account-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" />
                ) : (
                  <User size={20} />
                )}
              </div>
              <ChevronDown size={16} className={showDropdown ? 'rotated' : ''} />
            </button>

            {showDropdown && (
              <div className="dropdown-menu">
                <div className="dropdown-header">
                  <div className="dropdown-avatar">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" />
                    ) : (
                      <User size={32} />
                    )}
                  </div>
                  <span className="dropdown-name">{userName}</span>
                </div>
                <div className="dropdown-divider" />
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setShowUploadModal(true);
                    setShowDropdown(false);
                  }}
                >
                  <Camera size={16} />
                  <span>Change Profile Picture</span>
                </button>
                {userRole === 'admin' && onSettingsClick && (
                  <>
                    <div className="dropdown-divider" />
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        onSettingsClick();
                        setShowDropdown(false);
                      }}
                    >
                      <Settings size={16} />
                      <span>Account Settings</span>
                    </button>
                  </>
                )}
                {userRole !== 'admin' && onPasswordChangeClick && (
                  <>
                    <div className="dropdown-divider" />
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        onPasswordChangeClick();
                        setShowDropdown(false);
                      }}
                    >
                      <Lock size={16} />
                      <span>Change Password</span>
                    </button>
                  </>
                )}
                <div className="dropdown-divider" />
                <button className="dropdown-item logout" onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showUploadModal && (
        <div className="avatar-modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="avatar-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowUploadModal(false)}>
              <X size={20} />
            </button>
            <h3>Update Profile Picture</h3>
            <div className="current-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Current Avatar" />
              ) : (
                <div className="no-avatar">
                  <User size={48} />
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
            />
            <div className="avatar-actions">
              <button
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Choose New Picture'}
              </button>
              {avatarUrl && (
                <button
                  className="remove-btn"
                  onClick={handleRemoveAvatar}
                >
                  Remove Picture
                </button>
              )}
            </div>
            <p className="upload-hint">Max 5MB. JPEG, PNG, GIF, or WebP</p>
          </div>
        </div>
      )}
    </>
  );
};

export default TopHeader;
